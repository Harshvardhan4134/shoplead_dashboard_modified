
import uuid
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from app import db
from models import WorkLog
from models import NCRTracker


logger = logging.getLogger(__name__)

def process_sap_data(file_path):
    """Process SAP data from Excel and return structured data."""
    try:
        print("🚀 Starting SAP data processing...")
        df = pd.read_excel(file_path, engine='openpyxl')
        df.columns = df.columns.str.strip().str.lower()

        if "oper.workcenter" not in df.columns:
            print("⚠️ Column 'oper.workcenter' not found in SAPDATA!")
            return

        print(f"✅ SAPDATA.xlsx loaded with {len(df)} rows.")
        
        # Process NCR Data
        process_ncr_data(df)
        print("🎯 SAPDATA processing complete!")

    except Exception as e:
        print(f"❌ Error processing SAP data: {str(e)}")



def process_ncr_data(df):
    try:
        required_columns = ['order', 'oper./act.', 'oper.workcenter', 'work', 'actual work']
        if not all(col in df.columns for col in required_columns):
            print("⚠️ SAPDATA.xlsx is missing required columns for NCR processing!")
            return

        # Filter NCR operations
        ncr_data = df[df['oper.workcenter'].str.upper() == 'NCR']

        if ncr_data.empty:
            print("ℹ️ No NCR operations found in SAPDATA.xlsx.")
            return

        # Insert NCR data into the database
        for _, row in ncr_data.iterrows():
            ncr_record = NCRTracker(
                ncr_number=str(uuid.uuid4()),  # Generate unique NCR number
                job_number=row['order'],
                work_order=row.get('order', 'Unknown'),  # Ensure work_order is not NULL
                operation_number=row['oper./act.'],
                planned_hours=row['work'],
                actual_hours=row['actual work'],
                issue_description=row.get('issue_description', 'No issue description provided'),  # ✅ Default value
                issue_category=row.get('issue_category', 'Uncategorized'),
                root_cause=row.get('root_cause', 'Unknown'),
                corrective_action=row.get('corrective_action', 'None'),
                financial_impact=row.get('financial_impact', 0.0),
                created_at=datetime.now(),
                status="Active" if row['actual work'] > 0 else "Pending"
            )
            db.session.add(ncr_record)

        db.session.commit()
        print("✅ NCR Data saved successfully!")

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error saving NCR data: {str(e)}")

        
def process_worklog_data(file_path):
    df = pd.read_excel(file_path, sheet_name='SAP Document Export')

    # Convert column names to lowercase for consistency
    df.columns = df.columns.str.strip().str.lower()

    for _, row in df.iterrows():
        worklog_entry = WorkLog(
            employee_id=int(row["pernr"]),
            employee_name=row["employeename"],
            job_number=str(int(row["order"])) if pd.notna(row["order"]) else None,
            work_order=str(int(row["operation"])) if pd.notna(row["operation"]) else None,
            operation_number=int(row["operation"]),
            operation_description=row["operation short text"],
            actual_hours=float(row["acutal work"]),
            posting_date=datetime.strptime(row["postingdate"], "%m/%d/%Y"),
            adjustment_text=row["adjustment confirmation text"] if pd.notna(row["adjustment confirmation text"]) else None,
            non_prod_code=row["nonprodcode"] if pd.notna(row["nonprodcode"]) else None
        )
        db.session.add(worklog_entry)

    db.session.commit()


