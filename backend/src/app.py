from datetime import timedelta, date, datetime

from fastapi import FastAPI, HTTPException, Depends, status, Form, Request, Body, APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func
from authx import AuthX, AuthXConfig, TokenPayload
from authx.exceptions import JWTDecodeError
from passlib.context import CryptContext
from typing import Dict, List
import json
import asyncio

from . import models, schema
from .db_init import get_db
from .config import JWT_SECRET_KEY


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://192.168.31.32:5500",
        #example.com
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
        
        
        for connection in disconnected:
            self.disconnect(connection)


websocket_manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            
            data = await websocket.receive_text()
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)


authx_cfg = AuthXConfig()
authx_cfg.JWT_SECRET_KEY = JWT_SECRET_KEY
authx_cfg.JWT_ACCESS_COOKIE_NAME = "access_token"
authx_cfg.JWT_REFRESH_COOKIE_NAME = "refresh_token"
authx_cfg.JWT_TOKEN_LOCATION = ["cookies"]
authx_cfg.JWT_COOKIE_SECURE = False        # на проде True - False
authx_cfg.JWT_COOKIE_SAMESITE = "Lax"      # на проде "None" - "Lax"
authx_cfg.JWT_COOKIE_HTTP_ONLY = True
authx_cfg.JWT_COOKIE_CSRF_PROTECT = False  

authx_security = AuthX(config=authx_cfg)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")




def get_role_and_branch(user: models.Users):
    if user.is_superuser:   
        return "director", None
    elif user.is_admin:     
        branch = "baitursynov" if user.baitursynov else "gagarina"
        return "admin", branch
    else:                   
        branch = "baitursynov" if user.baitursynov else "gagarina"
        return "employee", branch


async def get_current_user_data(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token: TokenPayload = await authx_security._auth_required(request=request)
    except JWTDecodeError:
        raise HTTPException(status_code=401, detail="Signature has expired")

    user_id = int(token.sub)
    stmt = select(models.Users).where(models.Users.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    role, branch = get_role_and_branch(user)
    return {"user": user, "role": role, "branch": branch}


async def require_user(current=Depends(get_current_user_data)):
    if not current or not current.get("user"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current



@app.post("/login")
async def login(
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.Users).where(models.Users.email == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not pwd_context.verify(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    role, branch = get_role_and_branch(user)

    access_token = authx_security.create_access_token(
        uid=str(user.id),
        expires=timedelta(minutes=30),
        data={"role": role, "branch": branch},
    )
    refresh_token = authx_security.create_refresh_token(
        uid=str(user.id),
        expires=timedelta(days=30),
        data={"role": role, "branch": branch},
    )

    response = JSONResponse(content={"msg": "login success"})
    authx_security.set_access_cookies(token=access_token, response=response)
    authx_security.set_refresh_cookies(token=refresh_token, response=response)
    return response


@app.post("/refresh")
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token: TokenPayload = await authx_security._auth_required(
            request=request,
            refresh=True
        )
        user_id = int(token.sub)

        stmt = select(models.Users).where(models.Users.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        role, branch = get_role_and_branch(user)


        new_access = authx_security.create_access_token(
            uid=str(user.id),
            expires=timedelta(minutes=30),
            data={"role": role, "branch": branch},
        )
        response = JSONResponse(content={"msg": "refreshed"})
        authx_security.set_access_cookies(token=new_access, response=response)
        return response

    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")




@app.post("/users", response_model=schema.UserRead)
async def create_user(
    data: schema.UserCreate,
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    new_user = models.Users(
        email=data.email,
        password_hash=pwd_context.hash(data.password),
        f_name=data.f_name,
        l_name=data.l_name,
        m_name=data.m_name,
        baitursynov=data.baitursynov,
        gagarina=data.gagarina,
        is_superuser=data.is_superuser,
        is_admin=data.is_admin,
        position=data.position,
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
        return new_user
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {e}")




@app.get("/appointments", response_model=list[schema.AppointmentRead])
async def get_appointments(current=Depends(get_current_user_data), db: AsyncSession = Depends(get_db)):
    role = current["role"]
    user = current["user"]

    if role == "director":
        stmt = select(models.Appointments).options(
            selectinload(models.Appointments.user),
            selectinload(models.Appointments.clients)
        )
    elif role == "admin":
        stmt = (
            select(models.Appointments)
            .join(models.Users)
            .where(
                (models.Users.baitursynov == user.baitursynov)
                | (models.Users.gagarina == user.gagarina)
            )
            .options(
                selectinload(models.Appointments.user),
                selectinload(models.Appointments.clients)
            )
        )
    else:
        stmt = select(models.Appointments).where(models.Appointments.user_id == user.id).options(
            selectinload(models.Appointments.user),
            selectinload(models.Appointments.clients)
        )

    result = await db.execute(stmt)
    return result.scalars().all()



@app.get("/appointments_by_date/{date}", response_model=list[schema.AppointmentRead])
async def get_appointments_by_date(
    date: date,
    branch: str = Query(None, description="Фильтр по филиалу: baitursynov, gagarina"),
    session: AsyncSession = Depends(get_db),
    current=Depends(require_user),
):
    role = current["role"]
    user = current["user"]

    base_q = (
        select(models.Appointments)
        .where(func.date(models.Appointments.date_of_appointment) == date)
        .options(
            selectinload(models.Appointments.user),
            selectinload(models.Appointments.clients)
        )
    )

    if branch and branch in ['baitursynov', 'gagarina']:
        if branch == 'baitursynov':
            base_q = base_q.join(models.Users).where(models.Users.baitursynov == True)
        else:
            base_q = base_q.join(models.Users).where(models.Users.gagarina == True)

    if role == "director":
        q = base_q
    elif role == "admin":
        q = base_q.join(models.Users).where(
            (models.Users.baitursynov == user.baitursynov)
            | (models.Users.gagarina == user.gagarina)
        )
    else:
        q = base_q.where(models.Appointments.user_id == user.id)

    res = await session.execute(q)
    return res.scalars().all()



@app.get("/appointments_by_datetime/{datetime_str}", response_model=list[schema.AppointmentRead])
async def get_appointments_by_datetime(
    datetime_str: str,
    session: AsyncSession = Depends(get_db),
    current=Depends(require_user),
):
    try:
        from datetime import datetime
        target_datetime = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))

        role = current["role"]
        user = current["user"]

        base_q = (
            select(models.Appointments)
            .where(models.Appointments.date_of_appointment == target_datetime)
            .options(
                selectinload(models.Appointments.user),
                selectinload(models.Appointments.clients)
            )
        )

        if role == "director":
            q = base_q
        elif role == "admin":
            q = base_q.join(models.Users).where(
                (models.Users.baitursynov == user.baitursynov)
                | (models.Users.gagarina == user.gagarina)
            )
        else:
            q = base_q.where(models.Appointments.user_id == user.id)

        res = await session.execute(q)
        return res.scalars().all()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")



@app.post("/appointments", response_model=schema.AppointmentRead)
async def create_appointment(
    data: dict,
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        from datetime import datetime

        if not data.get("user_id") or not data.get("date_of_appointment") or not data.get("client_id"):
            raise HTTPException(status_code=400, detail="Missing required fields")

        appointment_datetime = datetime.fromisoformat(data["date_of_appointment"])

        new_appointment = models.Appointments(
    date_of_creation=datetime.now(),
    date_of_appointment=appointment_datetime,
    user_id=int(data["user_id"]),
    client_id=int(data["client_id"]),
    price=data.get("price"),
    course=data.get("course"),
    discount=data.get("discount"),
    type_of_payment=data.get("type_of_payment"),
    type_of_massage=data.get("type_of_massage"),
    duration=data.get("duration"),
    service=data.get("service"),
)

        
        db.add(new_appointment)
        await db.commit()
        await db.refresh(new_appointment)

        
        
        await websocket_manager.broadcast({
            "type": "appointment_created",
            "date": appointment_datetime.date().isoformat(),
            "branch": "all",  
            "appointment_id": new_appointment.id
        })

        await db.refresh(new_appointment, ["user", "clients"])
        return new_appointment

    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid date_of_appointment format: {e}")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating appointment: {str(e)}")

@app.delete("/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: int,
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(models.Appointments).where(models.Appointments.id == appointment_id)
        )
        appointment = result.scalar_one_or_none()

        if appointment:
            
            appointment_date = appointment.date_of_appointment.date()
            
            await db.delete(appointment)
            await db.commit()
            
            
            await websocket_manager.broadcast({
                "type": "appointment_deleted",
                "date": appointment_date.isoformat(),
                "branch": "all",
                "appointment_id": appointment_id
            })
            
            return {"message": "Appointment deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Appointment not found")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting appointment: {e}")




@app.get("/users")
async def get_users(current=Depends(require_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Users))
    return result.scalars().all()


@app.get("/clients")
async def get_clients(current=Depends(require_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Clients))
    clients = result.scalars().all()
    return clients


@app.get("/services")
async def get_services():
    return {'здесь пока нихера нет'}


@app.get("/specialists")
async def get_specialists(current=Depends(require_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Users))
    users = result.scalars().all()
    return [user for user in users if not user.is_superuser and not user.is_admin]


@app.get("/appointments_by_timeslot/{date}/{time}", response_model=list[schema.AppointmentRead])
async def get_appointments_by_timeslot(
    date: date,
    time: str,
    session: AsyncSession = Depends(get_db),
    current=Depends(require_user),
):
    try:
        from datetime import datetime, timedelta
        hour, minute = map(int, time.split(":"))
        start_time = datetime.combine(date, datetime.min.time()) + timedelta(hours=hour, minutes=minute)
        end_time = start_time + timedelta(minutes=14, seconds=59)

        role = current["role"]
        user = current["user"]

        base_q = (
            select(models.Appointments)
            .where(
                models.Appointments.date_of_appointment >= start_time,
                models.Appointments.date_of_appointment <= end_time,
            )
            .options(
                selectinload(models.Appointments.user),
                selectinload(models.Appointments.clients)
            )
        )

        if role == "director":
            q = base_q
        elif role == "admin":
            q = base_q.join(models.Users).where(
                (models.Users.baitursynov == user.baitursynov)
                | (models.Users.gagarina == user.gagarina)
            )
        else:
            q = base_q.where(models.Appointments.user_id == user.id)

        res = await session.execute(q)
        return res.scalars().all()

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format")



@app.get("/protected")
async def protected(current=Depends(require_user)):
    return {"msg": "ok", "user": current["user"].email, "role": current["role"]}


@app.post("/logout")
async def logout():
    response = JSONResponse(content={"msg": "logout success"})
    authx_security.unset_access_cookies(response)
    authx_security.unset_refresh_cookies(response)
    return response





@app.put("/appointments/{appointment_id}/finish")
async def finish_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current=Depends(require_user),
):
    result = await db.execute(
        select(models.Appointments).where(models.Appointments.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.is_finished = True
    await db.commit()
    await db.refresh(appointment)
    
    
    await websocket_manager.broadcast({
        "type": "appointment_completed",
        "date": appointment.date_of_appointment.date().isoformat(),
        "branch": "all",
        "appointment_id": appointment_id
    })
    
    return {"message": "Appointment finished"}

@app.post("/clients", response_model=schema.ClientRead)
async def create_client(
    data: schema.ClientCreate,
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    new_client = models.Clients(
        f_name=data.f_name,
        l_name=data.l_name,
        m_name=data.m_name,
        phone=data.phone,
        email=data.email,
    )
    db.add(new_client)
    try:
        await db.commit()
        await db.refresh(new_client)
        return new_client
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {e}")



@app.delete("/clients/{client_id}")
async def delete_client(
    client_id: int,
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(models.Clients).where(models.Clients.id == client_id)
        )
        client = result.scalar_one_or_none()

        if client:
            await db.delete(client)
            await db.commit()
            return {"message": "Client deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Client not found")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting client: {e}")




@app.get("/expenses", response_model=list[schema.ExpenseRead])
async def get_expenses(
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(models.Expenses))
    return result.scalars().all()


@app.post("/expenses", response_model=schema.ExpenseRead)
async def create_expense(
    data: schema.ExpenseCreate,
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    new_expense = models.Expenses(
        name=data.name,
        expense=data.expense,
    )
    db.add(new_expense)
    try:
        await db.commit()
        await db.refresh(new_expense)
        return new_expense
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: int,
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(models.Expenses).where(models.Expenses.id == expense_id)
        )
        expense = result.scalar_one_or_none()

        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        await db.delete(expense)
        await db.commit()
        return {"message": "Expense deleted successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting expense: {e}")



async def calculate_salaries(
    db: AsyncSession,
    role: str,
    user: models.Users,
    start_date: date | None = None,
    end_date: date | None = None,
):
    net_amount = (
        (func.coalesce(models.Appointments.price, 0)
         - (func.coalesce(models.Appointments.price, 0) * (func.coalesce(models.Appointments.discount, 0) / 100.0)))
    )

    salary_expr = func.sum(net_amount * (func.coalesce(models.Salaries.percent, 0) / 100.0)).label("salary")

    q = (
        select(
            models.Users.id,
            models.Users.f_name,
            models.Users.l_name,
            models.Users.m_name,
            salary_expr
        )
        .join(models.Appointments, models.Appointments.user_id == models.Users.id)
        .outerjoin(models.Salaries, models.Salaries.user_id == models.Users.id)
        .where(models.Appointments.is_finished == True)
    )

    
    if start_date and end_date:
        q = q.where(
            func.date(models.Appointments.date_of_appointment).between(start_date, end_date)
        )

    q = q.group_by(
        models.Users.id,
        models.Users.f_name,
        models.Users.l_name,
        models.Users.m_name
    )

    if role == "director":
        q_final = q
    elif role == "admin":
        q_final = q.where(
            (models.Users.baitursynov == user.baitursynov)
            | (models.Users.gagarina == user.gagarina)
        )
    else:
        q_final = q.where(models.Users.id == user.id)

    res = await db.execute(q_final)
    return res.mappings().all()


@app.get("/salaries")
async def get_salaries(
    start_date: str | None = Query(None, description="Дата начала периода (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="Дата конца периода (YYYY-MM-DD)"),
    current=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    role = current["role"]
    user = current["user"]

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
        end = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

        rows = await calculate_salaries(db, role, user, start, end)
        return [
            {
                "id": r["id"],
                "f_name": r["f_name"],
                "l_name": r["l_name"],
                "m_name": r["m_name"],
                "salary": round((r["salary"] or 0), 2),
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating salaries: {e}")

