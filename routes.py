
import os
import pandas as pd
from flask import render_template, request, jsonify, Response, stream_with_context
from app import app, db
from models import Job, WorkOrder, Operation, WorkLog, NCRTracker
from utils import process_sapdata, calculate_forecast
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import logging
from flask import jsonify
import json
from concurrent.futures import ThreadPoolExecutor

# Configure thread pool for background tasks
executor = ThreadPoolExecutor(max_workers=3)

@app.route('/')
def dashboard():
    work_centers = db.session.query(Operation.work_center).distinct().all()
    work_centers = [wc[0] for wc in work_centers]
    return render_template('dashboard.html', work_centers=work_centers)

@app.route('/scheduling')
def scheduling():
    return render_template('scheduling.html')

@app.route('/forecasting')
def forecasting():
    return render_template('forecasting.html')

@app.route('/work_centers')
def work_centers():
    return render_template('work_centers.html')

@app.route('/purchase')
def purchase():
    return render_template('purchase.html')

@app.route('/ncr_tracker')
def ncr_tracker():
    return render_template('ncr_tracker.html')

@app.route('/api/jobs')
def get_jobs():
    try:
        job_number = request.args.get('job_number')
        part = request.args.get('part')  # This refers to operation_number

        query = Job.query
        if job_number:
            query = query.filter(Job.job_number == job_number)

        jobs = query.all()

        result = [
            {
                'job_number': job.job_number,
                'customer_name': job.customer_name if job.customer_name else "Unknown Customer",
                'work_orders': [
                    {
                        'work_order_number': wo.work_order_number,
                        'operations': [
                            {
                                'operation_number': op.operation_number,
                                'work_center': op.work_center,
                                'planned_hours': op.planned_hours,
                                'actual_hours': op.actual_hours,
                                'status': op.status,
                                'scheduled_date': op.scheduled_date.isoformat() if op.scheduled_date else None
                            }
                            for op in wo.operations if not part or str(op.operation_number) == part
                        ]
                    }
                    for wo in job.work_orders
                ]
            }
            for job in jobs
        ]
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error fetching jobs: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500


@app.route('/api/work_centers')
def get_work_centers():
    try:
        work_centers = db.session.query(Operation.work_center).distinct().all()
        result = {}

        for wc in work_centers:
            work_center = wc[0]
            operations = Operation.query.filter_by(work_center=work_center).all()

            planned_hours = sum(op.planned_hours for op in operations)
            actual_hours = sum(op.actual_hours for op in operations)
            efficiency = round((actual_hours / planned_hours * 100) if planned_hours else 0)

            result[work_center] = {
                "planned_hours": planned_hours,
                "actual_hours": actual_hours,
                "efficiency": efficiency,
                "capacity": planned_hours * 1.2,  # Example capacity calculation
                "load_status": "Normal"
            }

        return jsonify(result)
    except Exception as e:
        logging.error(f"Error fetching work centers: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/forecast')
def get_forecast():
    try:
        work_centers = db.session.query(Operation.work_center).distinct().all()
        forecast_data = {}

        for wc in work_centers:
            work_center = wc[0]
            operations = Operation.query.filter_by(work_center=work_center).all()

            planned = sum(op.planned_hours or 0 for op in operations)
            actual = sum(op.actual_hours or 0 for op in operations)
            remaining = max(planned - actual, 0)

            forecast_data[work_center] = {
                "planned_hours": planned,
                "actual_hours": actual,
                "remaining_hours": remaining,
                "projected_hours": planned * 1.1  # Example projection
            }

        return jsonify(forecast_data)
    except Exception as e:
        logging.error(f"Error generating forecast: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_sapdata():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        if not file.filename.endswith('.xlsx'):
            return jsonify({"error": "Invalid file format. Please upload an Excel (.xlsx) file"}), 400

        # Check if the file has already been uploaded
        uploaded_files = [f.filename for f in os.listdir(app.config['UPLOAD_FOLDER'])]
        if file.filename in uploaded_files:
            return jsonify({"error": "File already uploaded"}), 400

        file.save(os.path.join(app.config['UPLOAD_FOLDER'], file.filename))
        process_sapdata(pd.read_excel(file, engine='openpyxl'))
        return jsonify({"status": "success", "message": "File uploaded and processed successfully."})
    except Exception as e:
        app.logger.error(f"Upload error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/schedule', methods=['GET', 'POST'])
def schedule():
    if request.method == 'POST':
        data = request.json
        operation = Operation.query.get(data['operation_id'])
        if operation:
            operation.scheduled_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            db.session.commit()
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Operation not found"}), 404

    # Get today's date and next week's date range
    today = datetime.today().date()
    next_week = today + timedelta(days=7)

    # Fetch scheduled operations for today and this week
    daily_operations = Operation.query.filter(Operation.scheduled_date == today).all()
    weekly_operations = Operation.query.filter(
        Operation.scheduled_date > today, Operation.scheduled_date <= next_week
    ).all()

    # Structure data into separate lists for daily & weekly schedules
    response_data = {
        "daily_schedule": [
            {
                "id": op.id,
                "title": f"{op.work_order.work_order_number} - Op {op.operation_number}",
                "start": op.scheduled_date.isoformat(),
                "work_center": op.work_center
            }
            for op in daily_operations
        ],
        "weekly_schedule": [
            {
                "id": op.id,
                "title": f"{op.work_order.work_order_number} - Op {op.operation_number}",
                "start": op.scheduled_date.isoformat(),
                "work_center": op.work_center
            }
            for op in weekly_operations
        ]
    }

    return jsonify(response_data)
# work log code here 
@app.route('/api/worklog', methods=['GET'])
def get_worklog():
    worklogs = WorkLog.query.all()
    return jsonify([log.to_dict() for log in worklogs])


@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle AI chat interactions"""
    try:
        data = request.get_json()
        message = data.get('message', '').lower()

        # Basic response logic based on keywords
        if 'jobs in progress' in message:
            active_jobs = Job.query.join(WorkOrder).join(Operation).filter(
                Operation.status != 'Completed'
            ).distinct().count()
            return jsonify({
                'response': f"There are currently {active_jobs} jobs in progress."
            })

        elif 'efficiency' in message and 'work center' in message:
            # Extract work center name from message
            work_center = message.split('work center')[-1].strip()
            operations = Operation.query.filter_by(work_center=work_center).all()
            if operations:
                total_planned = sum(op.planned_hours for op in operations) or 1
                total_actual = sum(op.actual_hours for op in operations)
                efficiency = round((total_actual / total_planned) * 100)
                return jsonify({
                    'response': f"The efficiency for {work_center} is {efficiency}%"
                })
            return jsonify({'response': f"Could not find data for work center: {work_center}"})

        elif 'remaining work' in message and 'job' in message:
            # Extract job number from message
            job_number = ''.join(filter(str.isdigit, message))
            if job_number:
                job = Job.query.filter_by(job_number=job_number).first()
                if job:
                    total_remaining = 0
                    for wo in job.work_orders:
                        for op in wo.operations:
                            if op.status != 'Completed':
                                total_remaining += op.planned_hours - op.actual_hours
                    return jsonify({
                        'response': f"Job {job_number} has {total_remaining:.1f} hours of remaining work."
                    })
                return jsonify({'response': f"Could not find job number: {job_number}"})

        return jsonify({
            'response': "I can help you with:\n" +
                       "- Number of jobs in progress\n" +
                       "- Work center efficiency\n" +
                       "- Remaining work for specific jobs\n" +
                       "Please ask me about these topics!"
        })

    except Exception as e:
        logging.error(f"Chat API error: {str(e)}")
        return jsonify({
            'response': "I'm sorry, I encountered an error processing your request."
        }), 500

@app.route('/api/job_details')
def get_job_details():
    job_number = request.args.get('job_number')
    if not job_number:
        return jsonify({"error": "Missing job number"}), 400
    
    job = Job.query.filter_by(job_number=job_number).first()
    if not job:
        return jsonify({"error": "Job not found"}), 404
    
    result = {
        "job_number": job.job_number,
        "customer_name": job.customer_name if job.customer_name else "Unknown Customer",
        "work_orders": [
            {
                "work_order_number": wo.work_order_number,
                "operations": [
                    {
                        "operation_number": op.operation_number,
                        "description": getattr(op, "description", "No description"),
                        "work_center": op.work_center,
                        "planned_hours": op.planned_hours,
                        "actual_hours": op.actual_hours,
                        "status": op.status,
                        "scheduled_date": op.scheduled_date.isoformat() if op.scheduled_date else None
                    }
                    for op in wo.operations
                ]
            }
            for wo in job.work_orders
        ]
    }
    return jsonify(result)

@app.route('/api/update_schedule', methods=['POST'])
def update_schedule():
    try:
        data = request.json
        operation_id = data['operation_id']
        new_date = data['new_date']

        operation = Operation.query.get(operation_id)
        if not operation:
            return jsonify({"error": "Operation not found"}), 404

        operation.scheduled_date = datetime.strptime(new_date, "%Y-%m-%d").date()
        db.session.commit()
        return jsonify({"status": "success", "message": "Schedule updated successfully."})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/ncr_monitor', methods=['GET'])
def check_ncr_operations():
    """Detect work orders where an NCR operation has started (actual_hours > 0)."""
    ncr_operations = Operation.query.filter(Operation.work_center == "NCR", Operation.actual_hours > 0).all()
    
    result = []
    for op in ncr_operations:
        ncr_data = {
            "job_number": op.work_order.job.job_number,
            "work_order": op.work_order.work_order_number,
            "operation_number": op.operation_number,
            "planned_hours": op.planned_hours,
            "actual_hours": op.actual_hours
        }
        result.append(ncr_data)
    
    return jsonify(result)

@app.route('/api/ncr_report', methods=['POST'])
def submit_ncr():
    """Allow users to submit an NCR report when an NCR event is detected."""
    data = request.json
    
    new_ncr = NCRTracker(
        ncr_number=data.get("ncr_number"),
        job_number=data.get("job_number"),
        work_order=data.get("work_order"),
        operation_number=data.get("operation_number"),
        part_name=data.get("part_name"),
        planned_hours=data.get("planned_hours"),
        actual_hours=data.get("actual_hours"),
        issue_description=data.get("issue_description"),
        issue_category=data.get("issue_category"),
        root_cause=data.get("root_cause"),
        corrective_action=data.get("corrective_action"),
        financial_impact=data.get("financial_impact", 0.0)
    )
    
    db.session.add(new_ncr)
    db.session.commit()
    
    return jsonify({"message": "NCR report submitted successfully"}), 201