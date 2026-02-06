import datetime

from typing import Annotated
from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


int_pk = Annotated[int, mapped_column(primary_key=True)]


class Base(DeclarativeBase):
    pass


class Users(Base):
    __tablename__ = 'users'
    id: Mapped[int_pk]

    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    f_name: Mapped[str | None] = mapped_column(String(255))
    l_name: Mapped[str | None] = mapped_column(String(255))
    m_name: Mapped[str | None] = mapped_column(String(255))

    baitursynov: Mapped[bool] = mapped_column(Boolean)
    gagarina: Mapped[bool] = mapped_column(Boolean)

    position: Mapped[str | None] = mapped_column(String(255))

class Clients(Base):
    __tablename__ = 'clients'
    id: Mapped[int_pk]

    f_name: Mapped[str | None] = mapped_column(String(255))
    l_name: Mapped[str | None] = mapped_column(String(255))
    m_name: Mapped[str | None] = mapped_column(String(255))

    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(320))

    visit: Mapped[int | None]

    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    


class Appointments(Base):
    __tablename__ = 'appointments'
    id: Mapped[int_pk]

    date_of_creation: Mapped[datetime.datetime]
    date_of_appointment: Mapped[datetime.datetime]
    is_finished: Mapped[bool | None] = mapped_column(Boolean, default=False)

    price: Mapped[int | None]
    course: Mapped[str | None] = mapped_column(String(255))
    discount: Mapped[int | None]
    type_of_payment: Mapped[str | None] = mapped_column(String(255))
    type_of_massage: Mapped[str | None] = mapped_column(String(255))
    duration: Mapped[int | None]
    service: Mapped[str | None] = mapped_column(String(255))



    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    client_id: Mapped[int | None] = mapped_column(ForeignKey('clients.id'))

    user: Mapped["Users"] = relationship("Users", backref="appointments")
    clients: Mapped["Clients"] = relationship("Clients", backref="appointment")




class Salaries(Base):
    __tablename__ = 'salaries'
    id: Mapped[int_pk]

    salary: Mapped[int]
    percent: Mapped[int]
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))


class Expenses(Base):
    __tablename__ = 'expenses'
    id: Mapped[int_pk]

    name: Mapped[str | None] = mapped_column(String(255))
    expense: Mapped[int]
