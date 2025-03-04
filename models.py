
from app import db
from datetime import datetime

class Job(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_number = db.Column(db.String(50), unique=True, nullable=False)
    work_orders = db.relationship('WorkOrder', backref='job', lazy=True, cascade="all, delete-orphan")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class WorkOrder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    work_order_number = db.Column(db.String(50), unique=True, nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    operations = db.relationship('Operation', backref='work_order', lazy=True, cascade="all, delete-orphan")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Operation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operation_number = db.Column(db.Integer, nullable=False)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_order.id'), nullable=False)
    work_center = db.Column(db.String(50), nullable=False)
    planned_hours = db.Column(db.Float, nullable=False)
    actual_hours = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='Not Started')
    scheduled_date = db.Column(db.Date)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class WorkCenter(db.Model):
    __tablename__ = "work_center"  # Make sure this matches PostgreSQL

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    capacity = db.Column(db.Float, nullable=True)
    workers = db.Column(db.Integer, nullable=True)
    efficiency = db.Column(db.Float, nullable=True)
    planned_hours = db.Column(db.Float, default=0)
    actual_hours = db.Column(db.Float, default=0)
    available_work = db.Column(db.Float, default=0)
    backlog = db.Column(db.Float, default=0)
    load_status = db.Column(db.String(20), default="Normal")
    projected_hours = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


