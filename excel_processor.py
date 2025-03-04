
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def process_sap_data(df):
    """Process SAP data from Excel and return structured data."""
    try:
        logger.info("Starting SAP data processing")
        
        # Convert column names to lowercase and strip whitespace
        df.columns = df.columns.str.strip().str.lower()
        logger.debug(f"Processed columns: {df.columns.tolist()}")

        # Define expected columns and their alternatives
        column_mapping = {
            'order': ['order', 'job', 'order_id'],
            'oper./act.': ['oper./act.', 'operation', 'operation_number'],
            'oper.workcenter': ['oper.workcenter', 'work_center', 'workcenter'],
            'description': ['description', 'task_description', 'task'],
            'work': ['work', 'planned_hours', 'planned'],
            'actual work': ['actual work', 'actual_hours', 'actual']
        }

        # Verify required columns exist
        for key, alternatives in column_mapping.items():
            if not any(col in df.columns for col in alternatives):
                raise KeyError(f"Missing required column {key}. Expected one of: {alternatives}")

        # Add date fields for tracking
        now = datetime.now()
        df['start_date'] = pd.to_datetime(df['start_date']).dt.strftime('%Y-%m-%d')
        df['completion_date'] = pd.to_datetime(df['completion_date']).dt.strftime('%Y-%m-%d')
        df['scheduled_date'] = pd.to_datetime(df['scheduled_date']).dt.strftime('%Y-%m-%d')  # Set a default schedule 3 days after start_date
        


        # Calculate remaining work
        df['remaining_work'] = df['work'].astype(float) - df['actual work'].astype(float)
        df['remaining_work'] = df['remaining_work'].apply(lambda x: max(x, 0))

        # Process work center statistics
        work_center_stats = df.groupby('oper.workcenter').agg({
            'work': 'sum',
            'actual work': 'sum',
            'remaining_work': 'sum'
        }).reset_index()

        # Calculate job counts per work center
        job_counts = df.groupby('oper.workcenter').size().reset_index(name='job_count')

        # Determine urgency levels
        def determine_urgency(row):
            if row['work'] == 0:
                return "Normal"
            ratio = row['remaining_work'] / row['work']
            if ratio > 0.5:
                return "Critical"
            elif ratio > 0.2:
                return "High"
            return "Normal"

        work_center_stats['urgency'] = work_center_stats.apply(determine_urgency, axis=1)

        # Prepare work centers data
        work_centers = (work_center_stats.merge(job_counts, on='oper.workcenter')
                       .rename(columns={'oper.workcenter': 'name'})
                       .to_dict('records'))

        # Prepare jobs data
        jobs = df[['order', 'oper./act.', 'oper.workcenter', 'description', 
          'work', 'actual work', 'start_date', 'completion_date', 
          'scheduled_date', 'remaining_work']].to_dict('records')


        logger.info(f"Processed {len(jobs)} jobs across {len(work_centers)} work centers")
        
        return {
            "jobs": jobs,
            "work_centers": work_centers,
            "schedules": []
        }
    # In excel_processor.py, update process_sap_data function:
        # Your existing code...
        
        # Ensure dates are properly formatted

        
        # Rest of your code...
        
    except Exception as e:
        logger.error(f"Error processing SAP data: {str(e)}")
        raise
