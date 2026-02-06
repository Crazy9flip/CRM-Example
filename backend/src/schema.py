
from pydantic import BaseModel, EmailStr
import datetime


class UserBase(BaseModel):
    email: EmailStr
    f_name: str | None = None
    l_name: str | None = None
    m_name: str | None = None
    baitursynov: bool = False
    gagarina: bool = False
    is_superuser: bool
    is_admin: bool
    position: str | None = None

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int

    class Config:
        from_attributes = True


class UserShort(BaseModel):
    f_name: str | None
    l_name: str | None
    baitursynov: bool
    gagarina: bool

    class Config:
        from_attributes = True









class SalaryBase(BaseModel):
    salary: int
    percent: int

class SalaryCreate(SalaryBase):
    user_id: int

class SalaryRead(SalaryBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True



class ClientBase(BaseModel):
    f_name: str | None = None
    l_name: str | None = None
    m_name: str | None = None
    phone: str | None = None
    email: str | None = None
    visit: int | None = None
    

class ClientCreate(ClientBase):
    pass

class ClientRead(ClientBase):
    id: int

    class Config:
        from_attributes = True

class ClientShort(BaseModel):
    f_name: str | None
    l_name: str | None
    phone: str | None

    class Config:
        from_attributes = True



class ExpenseBase(BaseModel):
    name: str | None = None
    expense: int

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseRead(ExpenseBase):
    id: int

    class Config:
        from_attributes = True




class AppointmentBase(BaseModel):
    date_of_creation: datetime.datetime
    date_of_appointment: datetime.datetime
    is_finished: bool = False

    price: int | None = None          
    course: str | None = None         
    discount: int | None = None       
    type_of_payment: str | None = None
    type_of_massage: str | None = None
    duration: int | None = None       
    service: str | None = None        

class AppointmentCreate(AppointmentBase):
    user_id: int

class AppointmentRead(AppointmentBase):
    id: int
    user: UserShort
    clients: ClientShort | None = None

    class Config:
        from_attributes = True

