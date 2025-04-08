
import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Table,
  Alert,
  Spinner,
  Modal,
  Form,
  Tabs,
  Tab,
  Badge,
  Dropdown,
  ProgressBar,
  ListGroup,
} from "react-bootstrap";
import * as faceapi from "face-api.js";
import "bootstrap/dist/css/bootstrap.min.css";

// IndexedDB setup
const DB_NAME = "AdvancedAttendanceDB";
const DB_VERSION = 3;
const STUDENTS_STORE = "students";
const ATTENDANCE_STORE = "attendance";
const CLASSES_STORE = "classes";
const SCHEDULES_STORE = "schedules";

const AttendanceSystem = () => {
  // Core state
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Camera and detection state
  const [captureActive, setCaptureActive] = useState(false);
  const [recognizedFaces, setRecognizedFaces] = useState([]);
  const [detectionsHistory, setDetectionsHistory] = useState({});
  const [isVideoRunning, setIsVideoRunning] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState("default");
  const [availableCameras, setAvailableCameras] = useState([]);
  const [matchThreshold, setMatchThreshold] = useState(0.4);
  const [detectionFrequency, setDetectionFrequency] = useState(5); // seconds
  const [multicamActive, setMulticamActive] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState("live");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedClass, setSelectedClass] = useState(null);

  // Form state
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [registrationProgress, setRegistrationProgress] = useState(0);
  const [registrationDescriptors, setRegistrationDescriptors] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [newScheduleClass, setNewScheduleClass] = useState("");
  const [newScheduleStartTime, setNewScheduleStartTime] = useState("");
  const [newScheduleEndTime, setNewScheduleEndTime] = useState("");
  const [newScheduleDays, setNewScheduleDays] = useState([]);

  // Analytics state
  const [attendanceStats, setAttendanceStats] = useState({
    presentCount: 0,
    absentCount: 0,
    attendanceRate: 0,
    lateCount: 0,
  });

  // Refs
  const videoRef = useRef();
  const secondaryVideoRef = useRef();
  const canvasRef = useRef();
  const secondaryCanvasRef = useRef();
  const captureIntervalRef = useRef();
  const dbRef = useRef();

  // Initialize the database with enhanced schema
  const initDB = async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        setError("Database error: " + event.target.errorCode);
        reject("Database error");
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create or update students store
        if (db.objectStoreNames.contains(STUDENTS_STORE)) {
          db.deleteObjectStore(STUDENTS_STORE);
        }
        const studentsStore = db.createObjectStore(STUDENTS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        studentsStore.createIndex("name", "name", { unique: false });
        studentsStore.createIndex("studentId", "studentId", { unique: true });
        studentsStore.createIndex("faceDescriptors", "faceDescriptors", {
          unique: false,
        });

        // Create or update attendance store
        if (db.objectStoreNames.contains(ATTENDANCE_STORE)) {
          db.deleteObjectStore(ATTENDANCE_STORE);
        }
        const attendanceStore = db.createObjectStore(ATTENDANCE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        attendanceStore.createIndex("studentId", "studentId", {
          unique: false,
        });
        attendanceStore.createIndex("classId", "classId", { unique: false });
        attendanceStore.createIndex("scheduleId", "scheduleId", {
          unique: false,
        });
        attendanceStore.createIndex("timestamp", "timestamp", {
          unique: false,
        });
        attendanceStore.createIndex("date", "date", { unique: false });
        attendanceStore.createIndex("status", "status", { unique: false });

        // Create classes store
        if (!db.objectStoreNames.contains(CLASSES_STORE)) {
          const classesStore = db.createObjectStore(CLASSES_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          classesStore.createIndex("name", "name", { unique: true });
          classesStore.createIndex("students", "students", { unique: false });
        }

        // Create schedules store
        if (!db.objectStoreNames.contains(SCHEDULES_STORE)) {
          const schedulesStore = db.createObjectStore(SCHEDULES_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          schedulesStore.createIndex("name", "name", { unique: true });
          schedulesStore.createIndex("classId", "classId", { unique: false });
          schedulesStore.createIndex("startTime", "startTime", {
            unique: false,
          });
          schedulesStore.createIndex("endTime", "endTime", { unique: false });
          schedulesStore.createIndex("days", "days", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbRef.current = event.target.result;
        resolve(dbRef.current);
      };
    });
  };

  // Load data from IndexedDB
  const loadStudentsData = async () => {
    return new Promise((resolve, reject) => {
      if (!dbRef.current) {
        reject("Database not initialized");
        return;
      }

      const transaction = dbRef.current.transaction(STUDENTS_STORE, "readonly");
      const store = transaction.objectStore(STUDENTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log("Loaded students:", request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        reject("Error loading students data");
      };
    });
  };

  const loadClassesData = async () => {
    return new Promise((resolve, reject) => {
      if (!dbRef.current) {
        reject("Database not initialized");
        return;
      }

      const transaction = dbRef.current.transaction(CLASSES_STORE, "readonly");
      const store = transaction.objectStore(CLASSES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log("Loaded classes:", request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        reject("Error loading classes data");
      };
    });
  };

  const loadSchedulesData = async () => {
    return new Promise((resolve, reject) => {
      if (!dbRef.current) {
        reject("Database not initialized");
        return;
      }

      const transaction = dbRef.current.transaction(
        SCHEDULES_STORE,
        "readonly"
      );
      const store = transaction.objectStore(SCHEDULES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log("Loaded schedules:", request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        reject("Error loading schedules data");
      };
    });
  };

  const loadAttendanceData = async (date, classId = null) => {
    return new Promise((resolve, reject) => {
      if (!dbRef.current) {
        console.error("Database not initialized in loadAttendanceData");
        reject("Database not initialized");
        return;
      }

      try {
        const today = date || new Date().toLocaleDateString();
        console.log("Loading attendance data for date:", today);

        const transaction = dbRef.current.transaction(
          ATTENDANCE_STORE,
          "readonly"
        );
        const store = transaction.objectStore(ATTENDANCE_STORE);

        // Use the date index
        const dateIndex = store.index("date");
        const request = dateIndex.getAll(today);

        request.onsuccess = () => {
          console.log(
            `Found ${request.result.length} attendance records for ${today}`
          );

          // Filter by class if specified
          let results = request.result;
          if (classId) {
            results = results.filter((record) => record.classId === classId);
            console.log(
              `Filtered to ${results.length} records for class ${classId}`
            );
          }

          resolve(results);
        };

        request.onerror = (event) => {
          console.error("Error in loadAttendanceData:", event);
          reject("Error loading attendance data");
        };
      } catch (error) {
        console.error("Exception in loadAttendanceData:", error);
        reject(error);
      }
    });
  };

  // Enhanced to include class and schedule information
  const addAttendanceRecord = async (
    studentId,
    classId,
    scheduleId,
    timestamp,
    date,
    status = "present"
  ) => {
    return new Promise((resolve, reject) => {
      try {
        console.log(
          `Starting addAttendanceRecord for student ${studentId} in class ${classId}`
        );

        if (!dbRef.current) {
          console.error("Database not initialized in addAttendanceRecord");
          reject("Database not initialized");
          return;
        }

        // Check if the student was already marked present in the last 5 MINUTES for this class
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

        const transaction = dbRef.current.transaction(
          ATTENDANCE_STORE,
          "readwrite"
        );

        transaction.onerror = (event) => {
          console.error("Transaction error in addAttendanceRecord:", event);
          reject("Transaction error");
        };

        const store = transaction.objectStore(ATTENDANCE_STORE);
        const todayDate = date || new Date().toLocaleDateString();

        console.log(
          `Checking recent attendance for student ${studentId} on ${todayDate}`
        );

        // Get all records for this student
        const index = store.index("studentId");
        const request = index.getAll(studentId);

        request.onsuccess = () => {
          const recentRecords = request.result.filter((record) => {
            // Check if record is from today and for this class
            if (
              record.date !== todayDate ||
              (classId && record.classId !== classId)
            )
              return false;

            // Convert timestamp to Date object for comparison
            const recordTime = new Date();
            const [hours, minutes, seconds] = record.timestamp.split(":");
            recordTime.setHours(hours, minutes, seconds);

            return recordTime > fiveMinutesAgo;
          });

          console.log(
            `Found ${recentRecords.length} recent records for student ${studentId}`
          );

          // If no recent record found, add a new one
          if (recentRecords.length === 0) {
            console.log(
              `Adding new attendance record for student ${studentId}`
            );
            const newRecord = {
              studentId,
              classId,
              scheduleId,
              timestamp,
              date: todayDate,
              status,
            };

            const addRequest = store.add(newRecord);

            addRequest.onsuccess = () => {
              console.log(
                "Successfully added attendance record:",
                addRequest.result
              );
              resolve(addRequest.result);
            };

            addRequest.onerror = (event) => {
              console.error("Error adding attendance record:", event);
              reject("Error adding attendance record");
            };
          } else {
            console.log(
              `Student ${studentId} already marked recently, skipping`
            );
            resolve(null); // Student already marked recently
          }
        };

        request.onerror = (event) => {
          console.error("Error checking recent attendance:", event);
          reject("Error checking recent attendance");
        };
      } catch (error) {
        console.error("Exception in addAttendanceRecord:", error);
        reject(error);
      }
    });
  };

  // Mark absent students for a class
  const markAbsentStudents = async (classId, scheduleId) => {
    try {
      if (!dbRef.current || !classId) return;

      const classData = classes.find((c) => c.id === classId);
      if (!classData) return;

      const today = new Date().toLocaleDateString();
      const currentTime = new Date().toLocaleTimeString();

      // Get today's attendance records for this class
      const attendance = await loadAttendanceData(today, classId);

      // Find students who are in the class but not in attendance
      const presentStudentIds = attendance.map((record) => record.studentId);
      const absentStudentIds = classData.students.filter(
        (studentId) => !presentStudentIds.includes(studentId)
      );

      console.log(
        `Marking ${absentStudentIds.length} students as absent for class ${classId}`
      );

      // Mark each absent student
      for (const studentId of absentStudentIds) {
        await addAttendanceRecord(
          studentId,
          classId,
          scheduleId,
          currentTime,
          today,
          "absent"
        );
      }

      // Reload attendance data
      const updatedRecords = await loadAttendanceData(today, classId);
      setAttendanceRecords(updatedRecords);

      return absentStudentIds.length;
    } catch (error) {
      console.error("Error marking absent students:", error);
      setError("Failed to mark absent students: " + error.message);
    }
  };

  // Generate attendance statistics
  const generateAttendanceStats = async (date, classId) => {
    try {
      if (!dbRef.current) return;

      const targetDate = date || new Date().toLocaleDateString();
      const attendanceData = await loadAttendanceData(targetDate, classId);

      let classStudentsCount = 0;
      if (classId) {
        const classData = classes.find((c) => c.id === classId);
        classStudentsCount = classData ? classData.students.length : 0;
      } else {
        classStudentsCount = students.length;
      }

      const presentStudents = attendanceData.filter(
        (record) => record.status === "present"
      );
      const lateStudents = attendanceData.filter(
        (record) => record.status === "late"
      );
      const absentStudents = attendanceData.filter(
        (record) => record.status === "absent"
      );

      const stats = {
        date: targetDate,
        totalStudents: classStudentsCount,
        presentCount: presentStudents.length,
        lateCount: lateStudents.length,
        absentCount: absentStudents.length,
        attendanceRate:
          classStudentsCount > 0
            ? (
                ((presentStudents.length + lateStudents.length) /
                  classStudentsCount) *
                100
              ).toFixed(1)
            : 0,
      };

      setAttendanceStats(stats);
      return stats;
    } catch (error) {
      console.error("Error generating attendance stats:", error);
    }
  };

  // New function to enumerate available cameras
  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      console.log("Available cameras:", videoDevices);

      setAvailableCameras(videoDevices);
      return videoDevices;
    } catch (error) {
      console.error("Error getting cameras:", error);
      setError("Failed to enumerate cameras: " + error.message);
      return [];
    }
  };

  // Initialize Face-api.js models
  const loadFaceApiModels = async () => {
    try {
      console.log("Starting to load face-api models...");

      const modelPath = process.env.PUBLIC_URL
        ? process.env.PUBLIC_URL + "/models"
        : "/models";
      console.log("Loading models from path:", modelPath);

      await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      console.log("SSD MobileNet model loaded");
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      console.log("Face landmark model loaded");
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      console.log("Face recognition model loaded");
      setModelsLoaded(true);
      console.log("All models loaded successfully");
    } catch (err) {
      console.error("Error loading face models:", err);
      setError("Error loading face models: " + err.message);
    }
  };

  // Initialize camera with device selection
  const initCamera = async (deviceId = null) => {
    try {
      console.log("Requesting camera access...");

      // Stop any existing stream
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
          : { width: 640, height: 480, facingMode: "user" },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log("Camera access granted:", stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setSelectedCamera(deviceId || "default");
        console.log("Video element source set successfully");
      } else {
        console.error("Video element reference not available");
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Camera error: " + err.message);
    }
  };

  // Initialize secondary camera for multi-camera support
  const initSecondaryCamera = async () => {
    try {
      if (availableCameras.length < 2) {
        setError("Secondary camera not available");
        return false;
      }

      // Use a different camera than the primary one
      const primaryCameraId =
        selectedCamera === "default" ? null : selectedCamera;
      const secondaryCameraId = availableCameras.find(
        (camera) => camera.deviceId !== primaryCameraId
      )?.deviceId;

      if (!secondaryCameraId) {
        setError("No distinct secondary camera available");
        return false;
      }

      const constraints = {
        video: {
          deviceId: { exact: secondaryCameraId },
          width: 640,
          height: 480,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (secondaryVideoRef.current) {
        secondaryVideoRef.current.srcObject = stream;
        console.log("Secondary camera initialized");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Secondary camera error:", error);
      setError("Failed to initialize secondary camera: " + error.message);
      return false;
    }
  };

  // Enhanced to process video frames for face detection with optimizations
  const processVideo = async (videoElement, canvasElement) => {
    if (!videoElement || !canvasElement || !modelsLoaded) {
      return [];
    }

    try {
      const options = new faceapi.SsdMobilenetv1Options({
        minConfidence: 0.5,
      });

      // Detect all faces in the video frame
      const detections = await faceapi
        .detectAllFaces(videoElement, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      const displaySize = {
        width: videoElement.width,
        height: videoElement.height,
      };

      faceapi.matchDimensions(canvasElement, displaySize);
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const context = canvasElement.getContext("2d");
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);

      // If no students are registered, just draw detection boxes
      if (students.length === 0) {
        faceapi.draw.drawDetections(canvasElement, resizedDetections);
        return [];
      }

      // Create face matchers with stored descriptors
      const labeledDescriptors = students.map((student) => {
        const descriptorsFloat32 = student.faceDescriptors.map(
          (desc) => new Float32Array(desc)
        );
        return new faceapi.LabeledFaceDescriptors(
          student.name,
          descriptorsFloat32
        );
      });

      const faceMatcher = new faceapi.FaceMatcher(
        labeledDescriptors,
        matchThreshold
      );

      // Match detected faces and track recognition confidence
      const recognizedStudents = [];
      const currentDetections = {};

      resizedDetections.forEach((detection) => {
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
        const box = detection.detection.box;

        // Format label with confidence score
        const confidence = (1 - bestMatch.distance).toFixed(2);
        const label =
          bestMatch.distance < matchThreshold
            ? `${bestMatch.label} (${confidence})`
            : `Unknown (${confidence})`;

        // Draw box and label
        const drawBox = new faceapi.draw.DrawBox(box, { label });
        drawBox.draw(canvasElement);

        // If match is good enough, add to recognized students
        if (
          bestMatch.label !== "unknown" &&
          bestMatch.distance < matchThreshold
        ) {
          const student = students.find((s) => s.name === bestMatch.label);
          if (student && !recognizedStudents.some((s) => s.id === student.id)) {
            recognizedStudents.push(student);

            // Store detection confidence for history tracking
            currentDetections[student.id] = parseFloat(confidence);
          }
        }
      });

      // Update detections history using the current detections
      setDetectionsHistory((prev) => {
        const newHistory = { ...prev };
        Object.keys(currentDetections).forEach((studentId) => {
          if (!newHistory[studentId]) {
            newHistory[studentId] = {
              count: 1,
              totalConfidence: currentDetections[studentId],
            };
          } else {
            newHistory[studentId].count += 1;
            newHistory[studentId].totalConfidence +=
              currentDetections[studentId];
          }
        });
        return newHistory;
      });

      return recognizedStudents;
    } catch (error) {
      console.error("Error processing video:", error);
      return [];
    }
  };

  // Enhanced to process both cameras
  const processBothCameras = async () => {
    const primaryRecognized = await processVideo(
      videoRef.current,
      canvasRef.current
    );

    let secondaryRecognized = [];
    if (
      multicamActive &&
      secondaryVideoRef.current &&
      secondaryCanvasRef.current
    ) {
      secondaryRecognized = await processVideo(
        secondaryVideoRef.current,
        secondaryCanvasRef.current
      );
    }

    // Combine results from both cameras, removing duplicates
    const allRecognized = [...primaryRecognized];
    secondaryRecognized.forEach((student) => {
      if (!allRecognized.some((s) => s.id === student.id)) {
        allRecognized.push(student);
      }
    });

    setRecognizedFaces(allRecognized);
    return allRecognized;
  };
  // Function to initialize camera specifically for registration
  const initRegistrationCamera = async () => {
    try {
      console.log("Initializing camera for registration...");

      // Stop any existing stream
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: { width: 640, height: 480, facingMode: "user" },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log("Video stream loaded and ready");
          videoRef.current
            .play()
            .catch((e) => console.error("Error playing video:", e));
        };
        setIsVideoRunning(true);
        return true;
      } else {
        console.error("Video element reference not available");
        return false;
      }
    } catch (err) {
      console.error("Camera access error during registration:", err);
      setError("Camera error: " + err.message);
      return false;
    }
  };
  // Start registration process with multiple face samples
  const startRegistration = () => {
    if (!newStudentName) {
      setError("Please enter a student name");
      return;
    }

    setRegistrationProgress(0);
    setRegistrationDescriptors([]);
    setShowRegisterModal(true);

    // Use the specialized camera initialization function
    setTimeout(() => {
      initRegistrationCamera().then((success) => {
        if (success) {
          setTimeout(() => captureRegistrationSample([]), 1000);
        } else {
          setError("Failed to initialize camera for registration");
        }
      });
    }, 500); // Short delay to allow the modal to render first
  };

  // Recursive function to capture multiple face samples
  const captureRegistrationSample = async (currentDescriptors) => {
    if (!videoRef.current || !modelsLoaded) {
      setError("Camera or face models not ready");
      return;
    }

    try {
      console.log(`Capturing sample ${currentDescriptors.length + 1}/5`);

      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setError(
          "No face detected. Please position your face clearly in the camera"
        );
        // Try again after a delay
        setTimeout(() => captureRegistrationSample(currentDescriptors), 1000);
        return;
      }

      // Add new descriptor to our working array
      const updatedDescriptors = [
        ...currentDescriptors,
        Array.from(detection.descriptor),
      ];

      // Update state for UI display
      setRegistrationDescriptors(updatedDescriptors);
      setRegistrationProgress((updatedDescriptors.length / 5) * 100);

      // Continue or finish
      if (updatedDescriptors.length < 5) {
        // Wait 1 second before next capture
        setTimeout(() => captureRegistrationSample(updatedDescriptors), 1000);
      } else {
        // Complete registration
        finalizeRegistration(updatedDescriptors);
      }
    } catch (error) {
      console.error("Error capturing face:", error);
      setError("Failed to capture face: " + error.message);
    }
  };

  // Save the registered student with multiple face samples
  const finalizeRegistration = async (descriptors) => {
    try {
      console.log("Finalizing registration for:", newStudentName);

      // Save the student with multiple descriptors
      const newStudent = {
        name: newStudentName,
        studentId: newStudentId || `ST${Date.now().toString().slice(-5)}`,
        faceDescriptors: descriptors,
      };

      const transaction = dbRef.current.transaction(
        STUDENTS_STORE,
        "readwrite"
      );
      const store = transaction.objectStore(STUDENTS_STORE);
      await new Promise((resolve, reject) => {
        const request = store.add(newStudent);
        request.onsuccess = resolve;
        request.onerror = reject;
      });

      console.log("Student added to database with multiple samples");

      // Reload students
      const updatedStudents = await loadStudentsData();
      setStudents(updatedStudents);
      setNewStudentName("");
      setNewStudentId("");
      setShowRegisterModal(false);

      // Show success message
      setError(null);
      alert(
        `Successfully registered ${newStudentName} with ${descriptors.length} face samples`
      );
    } catch (error) {
      console.error("Error registering student:", error);
      setError("Failed to register student: " + error.message);
    }
  };

  // Create a new class
  const createClass = async () => {
    try {
      if (!newClassName) {
        setError("Please enter a class name");
        return;
      }

      const newClass = {
        name: newClassName,
        students: classStudents,
        createdAt: new Date().toISOString(),
      };

      const transaction = dbRef.current.transaction(CLASSES_STORE, "readwrite");
      const store = transaction.objectStore(CLASSES_STORE);

      await new Promise((resolve, reject) => {
        const request = store.add(newClass);
        request.onsuccess = resolve;
        request.onerror = reject;
      });

      console.log("Class created:", newClassName);

      // Reload classes
      const updatedClasses = await loadClassesData();
      setClasses(updatedClasses);

      // Clear form
      setNewClassName("");
      setClassStudents([]);
      setShowClassModal(false);

      alert(`Successfully created class: ${newClassName}`);
    } catch (error) {
      console.error("Error creating class:", error);
      setError("Failed to create class: " + error.message);
    }
  };

  // Create a new schedule
  const createSchedule = async () => {
    try {
      if (
        !newScheduleName ||
        !newScheduleClass ||
        !newScheduleStartTime ||
        !newScheduleEndTime ||
        newScheduleDays.length === 0
      ) {
        setError("Please fill all schedule fields");
        return;
      }

      const newSchedule = {
        name: newScheduleName,
        classId: parseInt(newScheduleClass),
        startTime: newScheduleStartTime,
        endTime: newScheduleEndTime,
        days: newScheduleDays,
        createdAt: new Date().toISOString(),
      };

      const transaction = dbRef.current.transaction(
        SCHEDULES_STORE,
        "readwrite"
      );
      const store = transaction.objectStore(SCHEDULES_STORE);

      await new Promise((resolve, reject) => {
        const request = store.add(newSchedule);
        request.onsuccess = resolve;
        request.onerror = reject;
      });

      console.log("Schedule created:", newScheduleName);

      // Reload schedules
      const updatedSchedules = await loadSchedulesData();
      setSchedules(updatedSchedules);

      // Clear form
      setNewScheduleName("");
      setNewScheduleClass("");
      setNewScheduleStartTime("");
      setNewScheduleEndTime("");
      setNewScheduleDays([]);
      setShowScheduleModal(false);

      alert(`Successfully created schedule: ${newScheduleName}`);
    } catch (error) {
      console.error("Error creating schedule:", error);
      setError("Failed to create schedule: " + error.message);
    }
  };

  // Start the face detection process
  const startCapture = async () => {
    try {
      // Initialize/reinitialize camera if needed
      if (!isVideoRunning) {
        await initCamera(selectedCamera);

        // Initialize secondary camera if multi-camera mode is active
        if (multicamActive) {
          await initSecondaryCamera();
        }

        setIsVideoRunning(true);
      }

      // Clear any existing interval
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }

      setCaptureActive(true);
      setDetectionsHistory({});

      // Start processing frames at the set interval
      captureIntervalRef.current = setInterval(async () => {
        const recognized = await processBothCameras();

        // If we're in a selected class and schedule, mark attendance
        if (selectedClass) {
          const currentTime = new Date().toLocaleTimeString();
          const todayDate = new Date().toLocaleDateString();

          // Find relevant schedule if any
          const currentSchedule = schedules.find((schedule) => {
            // Check if schedule is for this class
            if (schedule.classId !== selectedClass) return false;

            // Check if today is in the schedule's days
            const today = new Date().getDay();
            const dayNames = [
              "sunday",
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
            ];
            if (!schedule.days.includes(dayNames[today])) return false;

            // Check if current time is within schedule time
            const now = new Date();
            const [startHour, startMinute] = schedule.startTime.split(":");
            const [endHour, endMinute] = schedule.endTime.split(":");

            const startTime = new Date();
            startTime.setHours(startHour, startMinute, 0);

            const endTime = new Date();
            endTime.setHours(endHour, endMinute, 0);

            return now >= startTime && now <= endTime;
          });

          const scheduleId = currentSchedule ? currentSchedule.id : null;

          // Mark attendance for each recognized face
          for (const student of recognized) {
            try {
              await addAttendanceRecord(
                student.id,
                selectedClass,
                scheduleId,
                currentTime,
                todayDate
              );
            } catch (error) {
              console.error(
                `Error marking attendance for ${student.name}:`,
                error
              );
            }
          }

          // Update attendance records
          const updatedRecords = await loadAttendanceData();
          setAttendanceRecords(updatedRecords);
        }
      }, detectionFrequency * 1000);
    } catch (error) {
      console.error("Error starting capture:", error);
      setError("Failed to start capture: " + error.message);
    }
  };

  // Stop the face detection process
  const stopCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }

    setCaptureActive(false);

    // Process detection history if it was active
    if (Object.keys(detectionsHistory).length > 0) {
      console.log("Final detection history:", detectionsHistory);
    }
  };

  // Handle class selection for attendance tracking
  const handleClassSelect = async (classId) => {
    setSelectedClass(parseInt(classId));

    if (classId) {
      const todayDate = new Date().toLocaleDateString();
      const records = await loadAttendanceData(todayDate, parseInt(classId));
      setAttendanceRecords(records);

      // Generate stats for the selected class
      await generateAttendanceStats(todayDate, parseInt(classId));
    } else {
      setAttendanceRecords([]);
      setAttendanceStats({
        presentCount: 0,
        absentCount: 0,
        attendanceRate: 0,
        lateCount: 0,
      });
    }
  };

  // Handle date change for reports
  const handleDateChange = async (date) => {
    setSelectedDate(date);

    const records = await loadAttendanceData(date, selectedClass);
    setAttendanceRecords(records);

    // Generate stats for the selected date and class
    await generateAttendanceStats(date, selectedClass);
  };

  // Export attendance report
  const exportAttendanceReport = () => {
    try {
      if (attendanceRecords.length === 0) {
        alert("No attendance data to export");
        return;
      }

      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Student ID,Student Name,Class,Date,Time,Status\n";

      attendanceRecords.forEach((record) => {
        const student = students.find((s) => s.id === record.studentId) || {
          name: "Unknown",
          studentId: record.studentId,
        };
        const className =
          classes.find((c) => c.id === record.classId)?.name || "Unknown";

        csvContent += `${student.studentId},${student.name},${className},${record.date},${record.timestamp},${record.status}\n`;
      });

      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `attendance_report_${selectedDate}.csv`);
      document.body.appendChild(link);

      // Trigger download
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting report:", error);
      setError("Failed to export report: " + error.message);
    }
  };

  // Delete a student
  const deleteStudent = async (studentId) => {
    try {
      if (!window.confirm("Are you sure you want to delete this student?")) {
        return;
      }

      const transaction = dbRef.current.transaction(
        STUDENTS_STORE,
        "readwrite"
      );
      const store = transaction.objectStore(STUDENTS_STORE);

      await new Promise((resolve, reject) => {
        const request = store.delete(studentId);
        request.onsuccess = resolve;
        request.onerror = reject;
      });

      console.log("Student deleted:", studentId);

      // Reload students
      const updatedStudents = await loadStudentsData();
      setStudents(updatedStudents);

      alert("Student deleted successfully");
    } catch (error) {
      console.error("Error deleting student:", error);
      setError("Failed to delete student: " + error.message);
    }
  };

  // Initialize the application
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);

        // Initialize IndexedDB
        await initDB();
        console.log("Database initialized");

        // Load face detection models
        await loadFaceApiModels();
        console.log("Face models loaded");

        // Get available cameras
        await getAvailableCameras();

        // Load data from IndexedDB
        const [studentsData, classesData, schedulesData] = await Promise.all([
          loadStudentsData(),
          loadClassesData(),
          loadSchedulesData(),
        ]);

        setStudents(studentsData);
        setClasses(classesData);
        setSchedules(schedulesData);

        // Load today's attendance
        const today = new Date().toLocaleDateString();
        const todayAttendance = await loadAttendanceData(today);
        setAttendanceRecords(todayAttendance);

        // Generate initial stats
        await generateAttendanceStats();

        setIsLoading(false);
      } catch (error) {
        console.error("Initialization error:", error);
        setError("Failed to initialize: " + error.message);
        setIsLoading(false);
      }
    };

    initialize();

    // Cleanup function
    return () => {
      // Stop any active capture
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }

      // Stop any active camera streams
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }

      if (secondaryVideoRef.current && secondaryVideoRef.current.srcObject) {
        secondaryVideoRef.current.srcObject
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  // Track changes in capture state
  useEffect(() => {
    if (!captureActive && videoRef.current && videoRef.current.srcObject) {
      // Clear canvas when stopping capture
      const context = canvasRef.current.getContext("2d");
      context.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      if (secondaryCanvasRef.current) {
        const secondaryContext = secondaryCanvasRef.current.getContext("2d");
        secondaryContext.clearRect(
          0,
          0,
          secondaryCanvasRef.current.width,
          secondaryCanvasRef.current.height
        );
      }
    }
  }, [captureActive]);

  return (
    <Container fluid>
      {isLoading ? (
        <div className="text-center p-5">
          <Spinner animation="border" />
          <p>Loading facial recognition system...</p>
        </div>
      ) : (
        <>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}

          <h1 className="text-center my-4">
            Advanced Classroom Attendance System
          </h1>

          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="live" title="Live Attendance">
              <Row>
                <Col md={8}>
                  <Card>
                    <Card.Header>
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">Face Recognition</h5>
                        <div>
                          <Dropdown className="me-2 d-inline-block">
                            <Dropdown.Toggle
                              variant="outline-secondary"
                              size="sm"
                            >
                              Camera:{" "}
                              {availableCameras.find(
                                (c) => c.deviceId === selectedCamera
                              )?.label || "Default"}
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                              <Dropdown.Item
                                onClick={() => initCamera("default")}
                              >
                                Default Camera
                              </Dropdown.Item>
                              {availableCameras.map((camera) => (
                                <Dropdown.Item
                                  key={camera.deviceId}
                                  onClick={() => initCamera(camera.deviceId)}
                                >
                                  {camera.label ||
                                    `Camera ${camera.deviceId.substring(0, 5)}`}
                                </Dropdown.Item>
                              ))}
                            </Dropdown.Menu>
                          </Dropdown>

                          <Button
                            variant={captureActive ? "danger" : "primary"}
                            onClick={captureActive ? stopCapture : startCapture}
                            disabled={!modelsLoaded}
                            className="me-2"
                          >
                            {captureActive ? "Stop Capture" : "Start Capture"}
                          </Button>

                          <Button
                            variant="outline-secondary"
                            onClick={() => setMulticamActive(!multicamActive)}
                            disabled={availableCameras.length < 2}
                          >
                            {multicamActive
                              ? "Disable 2nd Camera"
                              : "Enable 2nd Camera"}
                          </Button>
                        </div>
                      </div>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col>
                          <div className="position-relative">
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              playsInline
                              width="640"
                              height="480"
                              onPlay={() => setIsVideoRunning(true)}
                              style={{ display: "block", margin: "0 auto" }}
                            />
                            <canvas
                              ref={canvasRef}
                              width="640"
                              height="480"
                              style={{
                                position: "absolute",
                                top: 0,
                                left: "50%",
                                transform: "translateX(-50%)",
                              }}
                            />
                          </div>
                        </Col>

                        {multicamActive && (
                          <Col>
                            <div className="position-relative">
                              <video
                                ref={secondaryVideoRef}
                                autoPlay
                                muted
                                playsInline
                                width="640"
                                height="480"
                                style={{ display: "block", margin: "0 auto" }}
                              />
                              <canvas
                                ref={secondaryCanvasRef}
                                width="640"
                                height="480"
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                }}
                              />
                            </div>
                          </Col>
                        )}
                      </Row>

                      <Form.Group className="mt-3">
                        <Form.Label>
                          Recognition Threshold: {matchThreshold.toFixed(2)}
                        </Form.Label>
                        <Form.Range
                          min="0.2"
                          max="0.8"
                          step="0.05"
                          value={matchThreshold}
                          onChange={(e) =>
                            setMatchThreshold(parseFloat(e.target.value))
                          }
                        />
                      </Form.Group>

                      <Form.Group className="mt-3">
                        <Form.Label>
                          Detection Frequency: {detectionFrequency} seconds
                        </Form.Label>
                        <Form.Range
                          min="1"
                          max="10"
                          step="1"
                          value={detectionFrequency}
                          onChange={(e) =>
                            setDetectionFrequency(parseInt(e.target.value))
                          }
                        />
                      </Form.Group>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={4}>
                  <Card className="mb-3">
                    <Card.Header>
                      <h5 className="mb-0">Attendance Tracking</h5>
                    </Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Select Class:</Form.Label>
                        <Form.Select
                          value={selectedClass || ""}
                          onChange={(e) => handleClassSelect(e.target.value)}
                        >
                          <option value="">Select a class</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>

                      {selectedClass && (
                        <Button
                          variant="warning"
                          className="mb-3"
                          onClick={() => markAbsentStudents(selectedClass)}
                        >
                          Mark Absent Students
                        </Button>
                      )}

                      <Card className="bg-light">
                        <Card.Body>
                          <h6>Today's Attendance Stats</h6>
                          <p>
                            Present:{" "}
                            <Badge bg="success">
                              {attendanceStats.presentCount}
                            </Badge>
                          </p>
                          <p>
                            Absent:{" "}
                            <Badge bg="danger">
                              {attendanceStats.absentCount}
                            </Badge>
                          </p>
                          <p>
                            Late:{" "}
                            <Badge bg="warning">
                              {attendanceStats.lateCount}
                            </Badge>
                          </p>
                          <p>
                            Attendance Rate:{" "}
                            <Badge bg="info">
                              {attendanceStats.attendanceRate}%
                            </Badge>
                          </p>
                          <ProgressBar
                            variant="success"
                            now={attendanceStats.attendanceRate}
                            label={`${attendanceStats.attendanceRate}%`}
                          />
                        </Card.Body>
                      </Card>
                    </Card.Body>
                  </Card>

                  <Card>
                    <Card.Header>
                      <h5 className="mb-0">Recognized Students</h5>
                    </Card.Header>
                    <Card.Body>
                      {recognizedFaces.length > 0 ? (
                        <ListGroup>
                          {recognizedFaces.map((student) => (
                            <ListGroup.Item key={student.id}>
                              {student.name}{" "}
                              <Badge bg="primary">{student.studentId}</Badge>
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      ) : (
                        <p>No students recognized yet.</p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Tab>

            <Tab eventKey="students" title="Students">
              <Card>
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Student Management</h5>
                    <Button
                      variant="primary"
                      onClick={() => setShowRegisterModal(true)}
                    >
                      Register New Student
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  {students.length > 0 ? (
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Name</th>
                          <th>Face Samples</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id}>
                            <td>{student.studentId}</td>
                            <td>{student.name}</td>
                            <td>{student.faceDescriptors.length}</td>
                            <td>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => deleteStudent(student.id)}
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p>No students registered yet.</p>
                  )}
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="classes" title="Classes">
              <Card>
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Class Management</h5>
                    <Button
                      variant="primary"
                      onClick={() => setShowClassModal(true)}
                    >
                      Create New Class
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  {classes.length > 0 ? (
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>Class Name</th>
                          <th>Enrolled Students</th>
                          <th>Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map((cls) => (
                          <tr key={cls.id}>
                            <td>{cls.name}</td>
                            <td>{cls.students.length}</td>
                            <td>
                              {new Date(cls.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p>No classes created yet.</p>
                  )}
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="schedules" title="Schedules">
              <Card>
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Schedule Management</h5>
                    <Button
                      variant="primary"
                      onClick={() => setShowScheduleModal(true)}
                    >
                      Create New Schedule
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  {schedules.length > 0 ? (
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>Schedule Name</th>
                          <th>Class</th>
                          <th>Time</th>
                          <th>Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map((schedule) => (
                          <tr key={schedule.id}>
                            <td>{schedule.name}</td>
                            <td>
                              {
                                classes.find((c) => c.id === schedule.classId)
                                  ?.name
                              }
                            </td>
                            <td>
                              {schedule.startTime} - {schedule.endTime}
                            </td>
                            <td>
                              {schedule.days.map((day) => (
                                <Badge key={day} bg="info" className="me-1">
                                  {day.charAt(0).toUpperCase() + day.slice(1)}
                                </Badge>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p>No schedules created yet.</p>
                  )}
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="reports" title="Reports">
              <Card>
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Attendance Reports</h5>
                    <Button variant="success" onClick={exportAttendanceReport}>
                      Export Report
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Select Date:</Form.Label>
                        <Form.Control
                          type="date"
                          value={selectedDate}
                          onChange={(e) => handleDateChange(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Select Class:</Form.Label>
                        <Form.Select
                          value={selectedClass || ""}
                          onChange={(e) => handleClassSelect(e.target.value)}
                        >
                          <option value="">All Classes</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Card className="bg-light mb-3">
                    <Card.Body>
                      <h6>Report Summary</h6>
                      <Row>
                        <Col md={3}>
                          <p>
                            Date: <strong>{selectedDate}</strong>
                          </p>
                        </Col>
                        <Col md={3}>
                          <p>
                            Present:{" "}
                            <Badge bg="success">
                              {attendanceStats.presentCount}
                            </Badge>
                          </p>
                        </Col>
                        <Col md={3}>
                          <p>
                            Absent:{" "}
                            <Badge bg="danger">
                              {attendanceStats.absentCount}
                            </Badge>
                          </p>
                        </Col>
                        <Col md={3}>
                          <p>
                            Attendance Rate:{" "}
                            <Badge bg="info">
                              {attendanceStats.attendanceRate}%
                            </Badge>
                          </p>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  {attendanceRecords.length > 0 ? (
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Name</th>
                          <th>Class</th>
                          <th>Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.map((record) => {
                          const student = students.find(
                            (s) => s.id === record.studentId
                          ) || { name: "Unknown", studentId: record.studentId };
                          const className =
                            classes.find((c) => c.id === record.classId)
                              ?.name || "Unknown";

                          return (
                            <tr key={record.id}>
                              <td>{student.studentId}</td>
                              <td>{student.name}</td>
                              <td>{className}</td>
                              <td>{record.timestamp}</td>
                              <td>
                                <Badge
                                  bg={
                                    record.status === "present"
                                      ? "success"
                                      : record.status === "late"
                                      ? "warning"
                                      : "danger"
                                  }
                                >
                                  {record.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  ) : (
                    <p>No attendance records found for this date/class.</p>
                  )}
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </>
      )}

      {/* Register Student Modal */}
      <Modal
        show={showRegisterModal}
        onHide={() => {
          setShowRegisterModal(false);
          // Stop camera when closing modal
          if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject
              .getTracks()
              .forEach((track) => track.stop());
          }
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Register New Student</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Student Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter student name"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Student ID (optional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter student ID"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
              />
            </Form.Group>

            {showRegisterModal && (
              <>
                <div className="position-relative mb-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    width="100%"
                    height="240"
                    style={{ backgroundColor: "#000" }}
                  />
                  <canvas
                    ref={canvasRef}
                    width="640"
                    height="480"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </div>

                <ProgressBar
                  now={registrationProgress}
                  label={`${Math.round(registrationProgress)}%`}
                  className="mb-3"
                />

                <p>
                  Capturing face samples: {registrationDescriptors.length}/5
                </p>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowRegisterModal(false);
              // Stop camera when canceling
              if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject
                  .getTracks()
                  .forEach((track) => track.stop());
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={startRegistration}
            disabled={!newStudentName}
          >
            Register
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Create Class Modal */}
      <Modal show={showClassModal} onHide={() => setShowClassModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Class</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Class Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter class name"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Select Students</Form.Label>
              <Form.Select
                multiple
                value={classStudents}
                onChange={(e) => {
                  const selected = Array.from(
                    e.target.selectedOptions,
                    (option) => parseInt(option.value)
                  );
                  setClassStudents(selected);
                }}
                style={{ height: "200px" }}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.studentId})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowClassModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={createClass}
            disabled={!newClassName}
          >
            Create Class
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create Schedule Modal */}
      <Modal
        show={showScheduleModal}
        onHide={() => setShowScheduleModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Create New Schedule</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Schedule Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter schedule name"
                value={newScheduleName}
                onChange={(e) => setNewScheduleName(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Select Class</Form.Label>
              <Form.Select
                value={newScheduleClass}
                onChange={(e) => setNewScheduleClass(e.target.value)}
              >
                <option value="">Select a class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={newScheduleStartTime}
                    onChange={(e) => setNewScheduleStartTime(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={newScheduleEndTime}
                    onChange={(e) => setNewScheduleEndTime(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Select Days</Form.Label>
              <div>
                {[
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ].map((day) => (
                  <Form.Check
                    key={day}
                    inline
                    type="checkbox"
                    label={day.charAt(0).toUpperCase() + day.slice(1)}
                    checked={newScheduleDays.includes(day)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewScheduleDays([...newScheduleDays, day]);
                      } else {
                        setNewScheduleDays(
                          newScheduleDays.filter((d) => d !== day)
                        );
                      }
                    }}
                  />
                ))}
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowScheduleModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={createSchedule}
            disabled={
              !newScheduleName ||
              !newScheduleClass ||
              !newScheduleStartTime ||
              !newScheduleEndTime ||
              newScheduleDays.length === 0
            }
          >
            Create Schedule
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AttendanceSystem;
