
import os
import pandas as pd
from flask import render_template, request, jsonify, Response, stream_with_context
from app import app, db
from models import Job, WorkOrder, Operation
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

@app.route('/api/jobs')
def get_jobs():
    """Fetch all jobs with work orders & operations"""
    jobs = Job.query.all()
    logging.info(f"📌 Found {len(jobs)} jobs in database")

    result = [
        {
            'job_number': job.job_number,
            'status': job.work_orders[0].operations[0].status if job.work_orders else "Unknown",
            'start_date': job.work_orders[0].operations[0].scheduled_date.isoformat() if job.work_orders and job.work_orders[0].operations and job.work_orders[0].operations[0].scheduled_date else None,
'due_date': job.work_orders[0].operations[0].completed_at.isoformat() if job.work_orders and job.work_orders[0].operations and job.work_orders[0].operations[0].completed_at else None,

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
                            'scheduled_date': op.scheduled_date.isoformat() if op.scheduled_date else None,
                            'completed_at': op.completed_at.isoformat() if op.completed_at else None
                        }
                        for op in wo.operations
                    ]
                }
                for wo in job.work_orders
            ]
        }
        for job in jobs
    ]

    logging.info(f"📌 API `/api/jobs` returned {len(result)} jobs")
    return jsonify(result)

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
        logging.info("📂 Starting file upload process...")

        if 'file' not in request.files:
            logging.error("❌ No file part in request")
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        logging.info(f"📌 Received file: {file.filename}")

        if file.filename == '':
            logging.error("❌ No selected file")
            return jsonify({"error": "No file selected"}), 400

        if not file.filename.endswith('.xlsx'):
            logging.error(f"❌ Invalid file format: {file.filename}")
            return jsonify({"error": "Invalid file format. Please upload an Excel (.xlsx) file"}), 400

        # Read Excel file directly from memory
        df = pd.read_excel(file, engine='openpyxl')
        
        # Process the data immediately
        process_sapdata(df)
        
        return jsonify({"status": "success", "message": "File uploaded and processed successfully."})

    except Exception as e:
        logging.error(f"❌ Upload error: {str(e)}")
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

    operations = Operation.query.filter(Operation.scheduled_date.isnot(None)).all()
    events = [{
        "id": op.id,
        "title": f"{op.work_order.work_order_number} - Op {op.operation_number}",
        "start": op.scheduled_date.isoformat(),
        "work_center": op.work_center
    } for op in operations]
    return jsonify(events)

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
