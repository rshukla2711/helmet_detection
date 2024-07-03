import cv2
import numpy as np
from ultralytics import YOLO
from pymongo import MongoClient
from datetime import datetime, timedelta
from threading import Thread
import pytz
import os
import json
import time
import logging
from dotenv import load_dotenv, dotenv_values
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s:%(message)s')

def get_last_detection(db_collection, source, current_time,location_dict):
    start_of_minute = current_time.replace(second=0, microsecond=0)
    end_of_minute = start_of_minute + timedelta(minutes=1)

    logging.info(f"Querying for the latest detection for {source} between {start_of_minute} and {end_of_minute}")

    latest_detection = db_collection.find_one(
        {
            "timestamp": {
                "$gte": start_of_minute,
                "$lt": end_of_minute
            },
            "Location": location_dict.get(source, "Unknown"),
            "date": current_time.strftime("%d/%m/%Y"),
            "source": source
        },
        sort=[("timestamp", -1)]
    )

    if latest_detection:
        logging.info(f"Latest detection found: {latest_detection['_id']}")
    else:
        logging.info("No latest detection found")

    return latest_detection

def delete_old_detections(db_collection, source, current_time, location_dict):
    logging.info(f"delete_old_detections function called for {source} at {current_time.strftime('%H:%M:%S')}")
    start_of_minute = current_time.replace(second=0, microsecond=0)
    end_of_minute = start_of_minute + timedelta(minutes=1)

    latest_detection = get_last_detection(db_collection, source, current_time,location_dict)

    if latest_detection:
        logging.info(f"Attempting to delete old detections for {source} at {current_time.strftime('%H:%M:%S')}")
        result = db_collection.delete_many({
            "_id": {"$ne": latest_detection["_id"]},
            "timestamp": {
                "$gte": start_of_minute,
                "$lt": end_of_minute
            },
            "Location": location_dict.get(source, "Unknown"),
            "date": current_time.strftime("%d/%m/%Y"),
            "source": source
        })
        logging.info(f"Deleted {result.deleted_count} old detections for {source} at {current_time.strftime('%H:%M:%S')}")
    else:
        logging.info(f"No latest detection found for {source} at {current_time.strftime('%H:%M:%S')}")

def detection_task(source, model, db_collection, location_dict):
    while True:
        try:
            video = cv2.VideoCapture(source)
            if not video.isOpened():
                logging.error(f"Failed to open video source: {source}")
                time.sleep(5)
                continue

            logging.info(f"Started processing video source: {source}")

            while True:
                ret, frame = video.read()
                if not ret:
                    logging.warning(f"Failed to retrieve frame from source: {source}")
                    break
                
                try:
                    results = model.track(frame, imgsz=640, show_conf=False, conf=0.5)
                    if len(results) > 0:
                        result = results[0]
                        arr = result.boxes.cls.cpu().tolist()
                        boxes = result.boxes.xyxy.cpu().tolist()
                        annotated_frame = result.plot()
                        
                        if 1.0 in arr:  
                            logging.info("Object detected")
                            current_time = datetime.now(pytz.timezone('Asia/Kolkata'))
                            date_str = current_time.strftime("%d/%m/%Y")
                            time_str = current_time.strftime("%H:%M:%S")
                            mydict = {
                                "time": time_str,
                                "date": date_str,
                                "Location": location_dict.get(source, "Unknown"),
                                "timestamp": current_time,
                                "source": source
                            }
                            db_collection.insert_one(mydict)
                            delete_old_detections(db_collection, source, current_time, location_dict)

                        cv2.imshow(f"Live Camera {source}", annotated_frame)
                        if cv2.waitKey(1) == ord('q'):
                            break
                except Exception as e:
                    logging.error(f"Error processing frame from source {source}: {e}")
                    continue

            video.release()
            cv2.destroyAllWindows()

        except Exception as e:
            logging.error(f"Error in detection task for source {source}: {e}")
        time.sleep(5)  

def main():
    client = MongoClient(os.getenv("DB_URL"))
    model = YOLO('save_best1.pt')
    mydb = client["helmetDB"]
    mycol = mydb["withoutHelmet"]
    mycol.create_index("timestamp")
    list_as_string = os.getenv("SOURCES")
    sources=json.loads(list_as_string)
    print(sources)
    dict_as_string = os.getenv("LOCATION_DICT")
    location_dict=json.loads(dict_as_string)
    threads = []
    for source in sources:
        thread = Thread(target=detection_task, args=(source, model, mycol, location_dict))
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join()
        
if __name__ == "__main__":
    main()