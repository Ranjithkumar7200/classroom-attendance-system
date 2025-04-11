import { useState, useEffect } from "react";
import {
  Card,
  Button,
  Container,
  Row,
  Col,
  Alert,
  Spinner,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
// Note: You'll need to install these packages:
// npm install react-bootstrap bootstrap
// And import Bootstrap CSS in your app entry file:
// import 'bootstrap/dist/css/bootstrap.min.css';

// Sample CAPTCHA challenges
const CAPTCHA_TYPES = [
  { type: "cycles", description: "Select all bicycles" },
  { type: "cars", description: "Select all cars" },
  { type: "traffic_lights", description: "Select all traffic lights" },
  { type: "animals", description: "Select all animals" },
  { type: "food", description: "Select all food items" },
];

// Sample image database with their categories
const IMAGE_DATABASE = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=100&h=100&fit=crop",
    categories: ["cycles"],
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=100&h=100&fit=crop",
    categories: ["cars"],
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1562618817-5c78ca2ba8f9?q=80&w=2072&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    categories: ["traffic_lights"],
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=100&h=100&fit=crop",
    categories: ["cycles", "transport"],
  },
  {
    id: 5,
    url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=100&h=100&fit=crop",
    categories: ["animals"],
  },
  {
    id: 6,
    url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&h=100&fit=crop",
    categories: ["food"],
  },
  {
    id: 7,
    url: "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=100&h=100&fit=crop",
    categories: ["cars"],
  },
  {
    id: 8,
    url: "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=100&h=100&fit=crop",
    categories: ["animals"],
  },
  {
    id: 9,
    url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=100&h=100&fit=crop",
    categories: ["food"],
  },
  {
    id: 10,
    url: "https://images.unsplash.com/photo-1530652101053-8c0db4fbb5de?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    categories: ["traffic_lights"],
  },
  {
    id: 11,
    url: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=100&h=100&fit=crop",
    categories: ["cycles"],
  },
  {
    id: 12,
    url: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=100&h=100&fit=crop",
    categories: ["food"],
  },
  {
    id: 13,
    url: "https://images.unsplash.com/photo-1593764592116-bfb2a97c642a?w=100&h=100&fit=crop",
    categories: ["cars"],
  },
  {
    id: 14,
    url: "https://images.unsplash.com/photo-1530263503756-b382295fd927?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    categories: ["cycles"],
  },
  {
    id: 15,
    url: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=100&h=100&fit=crop",
    categories: ["traffic_lights"],
  },
  {
    id: 16,
    url: "https://images.unsplash.com/photo-1557456170-0cf4f4d0d362?w=100&h=100&fit=crop",
    categories: ["animals"],
  },
  {
    id: 17,
    url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=100&h=100&fit=crop",
    categories: ["food"],
  },
  {
    id: 18,
    url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=100&h=100&fit=crop",
    categories: ["traffic_lights"],
  },
  {
    id: 19,
    url: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=100&h=100&fit=crop",
    categories: ["animals"],
  },
  {
    id: 20,
    url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&h=100&fit=crop",
    categories: ["food"],
  },
  {
    id: 21,
    url: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=100&h=100&fit=crop",
    categories: ["cars"],
  },
  {
    id: 22,
    url: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=100&h=100&fit=crop",
    categories: ["cycles"],
  },
  {
    id: 23,
    url: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=100&h=100&fit=crop",
    categories: ["animals"],
  },
  {
    id: 24,
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    categories: ["food"],
  },
  {
    id: 25,
    url: "https://images.unsplash.com/photo-1650379391210-de99863f2d99?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    categories: ["traffic_lights"],
  },
];
export default function ImageCaptcha({ onVerified }) {
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState({});
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  // Initialize a new CAPTCHA challenge
  const initChallenge = () => {
    setIsVerified(false);
    setMessage("");

    // Select a random challenge
    const challenge =
      CAPTCHA_TYPES[Math.floor(Math.random() * CAPTCHA_TYPES.length)];
    setSelectedChallenge(challenge);

    // Get all images and shuffle them
    const shuffledImages = [...IMAGE_DATABASE].sort(() => 0.5 - Math.random());

    // Select a subset of images (9 total)
    setImages(shuffledImages.slice(0, 9));

    // Reset selections
    setSelectedImages({});
  };

  // Handle image selection
  const toggleImageSelection = (imageId) => {
    if (isVerified) return;

    setSelectedImages((prev) => ({
      ...prev,
      [imageId]: !prev[imageId],
    }));
  };

  // Verify if user selection is correct
  // Verify if user selection is correct
  const verifyCaptcha = () => {
    setIsVerifying(true);
    setMessage("");

    // Simulate server verification delay
    setTimeout(() => {
      // Check if all selected images match the challenge type
      let isCorrect = true;

      for (const image of images) {
        const isSelected = selectedImages[image.id] || false;
        const shouldBeSelected = image.categories.includes(
          selectedChallenge.type
        );

        if (isSelected !== shouldBeSelected) {
          isCorrect = false;
          break;
        }
      }

      if (isCorrect) {
        setIsVerified(true);
        setMessage("Verification successful! Redirecting...");

        // Call the parent component's onVerified callback
        if (onVerified) {
          onVerified(true);
        }

        // Navigate to attendance system after a brief delay
        setTimeout(() => {
          navigate("/attendance");
        }, 1500);
      } else {
        setMessage("Incorrect. Please try again.");
        setAttemptCount((prev) => prev + 1);

        // Reset after 3 failed attempts
        if (attemptCount >= 2) {
          initChallenge();
          setAttemptCount(0);
        }
      }

      setIsVerifying(false);
    }, 1000);
  };

  // Initialize CAPTCHA on component mount
  useEffect(() => {
    initChallenge();
  }, []);

  if (!selectedChallenge) {
    return (
      <Container className="d-flex justify-content-center align-items-center p-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading CAPTCHA...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container className="d-flex flex-column justify-content-center align-items-center vh-100">
      <h2 className="mb-5 text-center">🛡️ Image CAPTCHA Verification</h2>
      <Card className="mx-auto" style={{ maxWidth: "500px" }}>
        <Card.Header className="bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Security Verification</h5>
            <Button
              variant="outline-light"
              size="sm"
              onClick={initChallenge}
              aria-label="Refresh CAPTCHA"
            >
              ↻ Refresh
            </Button>
          </div>
        </Card.Header>

        <Card.Body>
          <Card.Title>{selectedChallenge.description}</Card.Title>

          <Row xs={3} className="g-2 mb-3">
            {images.map((image) => (
              <Col key={image.id}>
                <div
                  onClick={() => toggleImageSelection(image.id)}
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    height: "100px",
                    border: selectedImages[image.id]
                      ? "3px solid #0d6efd"
                      : "1px solid #dee2e6",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={image.url}
                    alt={`CAPTCHA image ${image.id}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {selectedImages[image.id] && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        backgroundColor: "#0d6efd",
                        borderRadius: "50%",
                        width: "25px",
                        height: "25px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>
              </Col>
            ))}
          </Row>

          {message && (
            <Alert variant={isVerified ? "success" : "danger"}>{message}</Alert>
          )}

          <Button
            variant={isVerified ? "success" : "primary"}
            className="w-100"
            onClick={verifyCaptcha}
            disabled={isVerified || isVerifying}
          >
            {isVerifying ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Verifying...
              </>
            ) : isVerified ? (
              "Verified"
            ) : (
              "Verify"
            )}
          </Button>
        </Card.Body>
      </Card>
    </Container>
  );
}
