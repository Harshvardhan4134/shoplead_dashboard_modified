
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from models import Job, WorkOrder, Operation
from app import db

logger = logging.getLogger(__name__)

# In utils.py, update the process_sapdata function:

        # ... (existing code) ...
        
        # Calculate dates
       
        
        # Create operation with proper date handling
        
        # ... (rest of the code)

def process_sapdata(df):
    """Process uploaded SAPDATA Excel file and update database"""
    try:
        logging.info(f"Starting SAPDATA processing with {len(df)} rows")
        
        # Clear existing data
        Operation.query.delete()
        WorkOrder.query.delete()
        Job.query.delete()
        db.session.commit()
        
        job_cache = {}
        work_order_cache = {}
        
        # Process each row
        for idx, row in df.iterrows():
            try:
                # Create job
                job_number = str(row['Order']).strip()
                if job_number not in job_cache:
                    job = Job(job_number=job_number)
                    db.session.add(job)
                    db.session.flush()
                    job_cache[job_number] = job
                
                # Create work order
                work_order_number = job_number  # Use job number as work order number
                wo_key = f"{job_number}_{work_order_number}"
                if wo_key not in work_order_cache:
                    work_order = WorkOrder(
                        work_order_number=work_order_number,
                        job_id=job_cache[job_number].id
                    )
                    db.session.add(work_order)
                    db.session.flush()
                    work_order_cache[wo_key] = work_order
                
                # Create operation
                operation = Operation(
                    operation_number=int(row['Oper./Act.']),
                    work_center=str(row['Oper.WorkCenter']),
                    planned_hours=float(row['Work']),
                    actual_hours=float(row['Actual work']) if pd.notna(row['Actual work']) else 0,
                    status='Completed' if pd.notna(row['Actual work']) and float(row['Actual work']) >= float(row['Work']) else 'In Progress',
                    scheduled_date=datetime.now().date(),
                    work_order_id=work_order_cache[wo_key].id
                )
                db.session.add(operation)
                
                if idx % 100 == 0:
                    db.session.commit()
                    
            except Exception as e:
                logging.error(f"Error processing row {idx}: {str(e)}")
                continue
                
        db.session.commit()
        return True
        
    except Exception as e:
        logging.error(f"Error processing SAPDATA: {str(e)}")
        db.session.rollback()
        raise

def calculate_forecast(operations):
    """Calculate forecasted completion time based on current progress"""
    total_planned = sum(op.planned_hours for op in operations)
    total_actual = sum(op.actual_hours for op in operations)
    
    if total_planned == 0 or total_actual == 0:
        return total_planned
    
    progress_rate = total_actual / total_planned
    if progress_rate == 0:
        return total_planned * 1.1  # Add 10% buffer
    
    return total_planned / progress_rate
