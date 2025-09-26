import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Stats, useProgress } from '@react-three/drei';
import * as THREE from 'three';

// Function to parse STL files (both binary and ASCII)
const parseSTL = (data) => {
  let isBinary = false;
  
  // Check if it's binary STL
  if (data instanceof ArrayBuffer) {
    isBinary = true;
  } else {
    // Check first 80 bytes for ASCII patterns
    const view = new DataView(data.slice(0, 80));
    let headerStr = '';
    for (let i = 0; i < 80; i++) {
      headerStr += String.fromCharCode(view.getUint8(i));
    }
    
    // If it doesn't start with "solid" it's likely binary
    if (!headerStr.trim().startsWith('solid')) {
      isBinary = true;
    }
  }

  if (isBinary) {
    return parseBinarySTL(data);
  } else {
    // For text data, we actually need the string
    const text = new TextDecoder().decode(data);
    return parseASCIISTL(text);
  }
};

// Parse binary STL files
const parseBinarySTL = (buffer) => {
  const view = new DataView(buffer);
  const header = new Uint8Array(buffer, 0, 80);
  const numTriangles = view.getUint32(80, true);

  const positions = new Float32Array(numTriangles * 3 * 3);
  let pos = 0;

  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50;
    // Skip the normal vector (12 bytes)
    // Read the three vertices (36 bytes total, 12 per vertex)
    for (let v = 0; v < 3; v++) {
      for (let j = 0; j < 3; j++) {
        positions[pos++] = view.getFloat32(offset + 12 + v * 12 + j * 4, true);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

// Parse ASCII STL files
const parseASCIISTL = (text) => {
  const geometry = new THREE.BufferGeometry();
  
  // Extract vertices from ASCII STL format
  const regex = /facet\s+normal\s+[\d.\-e]+\s+[\d.\-e]+\s+[\d.\-e]+\s+outer\s+loop\s+vertex\s+([\d.\-e]+)\s+([\d.\-e]+)\s+([\d.\-e]+)\s+vertex\s+([\d.\-e]+)\s+([\d.\-e]+)\s+([\d.\-e]+)\s+vertex\s+([\d.\-e]+)\s+([\d.\-e]+)\s+([\d.\-e]+)\s+endloop\s+endfacet/g;
  
  const positions = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Each triangle has 3 vertices with x, y, z coordinates
    for (let i = 1; i <= 9; i += 3) {
      positions.push(parseFloat(match[i]), parseFloat(match[i + 1]), parseFloat(match[i + 2]));
    }
  }

  if (positions.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
  }
  
  return geometry;
};

// Component to adjust camera based on mesh bounds
function CameraController({ meshRef, fitted, setFitted, fileName }) {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    if (meshRef.current && !fitted) {
      // Create a bounding box for the mesh
      const boundingBox = new THREE.Box3().setFromObject(meshRef.current);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      // Calculate the maximum dimension to determine camera distance
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Calculate distance based on model size with good margins
      const distance = maxDim * 3; // Multiplier to ensure object fits with good margins
      
      // Get center of the bounding box
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      
      // Position and orient the camera
      const direction = new THREE.Vector3(1, 1, 1).normalize();
      direction.multiplyScalar(distance);
      camera.position.copy(center.clone().add(direction));
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      
      // Mark as fitted to prevent repeated adjustments
      setTimeout(() => setFitted(true), 100);
    }
  }, [meshRef, fitted, fileName, camera]);

  return null;
}

// Loading component
const Loader = () => {
  const { progress } = useProgress();
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
      fontSize: '1.2rem',
      fontWeight: 'bold',
      color: 'white',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '1rem',
      borderRadius: '5px'
    }}>
      Loading: {Math.round(progress)}%
    </div>
  );
};

function STLViewer() {
  const [mesh, setMesh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fitted, setFitted] = useState(false);
  const fileInputRef = useRef(null);
  const meshRef = useRef();

  // Function to handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'model/stl' || file.name.toLowerCase().endsWith('.stl'))) {
      setLoading(true);
      setFileName(file.name);
      loadSTLFile(file);
    } else {
      alert('Please select a valid STL file');
    }
  };

  // Function to load STL file
  const loadSTLFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const contents = e.target.result;
        const geometry = parseSTL(contents);
        
        setMesh(geometry);
        setFitted(false); // Reset fitted flag when new file is loaded
        setLoading(false);
      } catch (error) {
        console.error('Error parsing STL file:', error);
        alert('Error parsing STL file. Please ensure it is a valid STL file.');
        setLoading(false);
      }
    };
    
    reader.onerror = function() {
      alert('Error reading file');
      setLoading(false);
    };
    
    // Determine if it's binary or text
    if (file.name.toLowerCase().endsWith('.stl')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Reset fitted flag when a new file is uploaded
  useEffect(() => {
    if (fileName) {
      setFitted(false);
    }
  }, [fileName]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ 
        padding: '1rem', 
        backgroundColor: '#2c3e50', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        color: 'white',
        flexShrink: 0
      }}>
        <h1 style={{ margin: 0 }}>STL File Viewer</h1>
        <div>
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".stl"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              marginRight: '1rem'
            }}
          >
            Upload STL File
          </button>
          
          {fileName && (
            <span style={{ 
              fontSize: '0.9rem',
              backgroundColor: '#34495e',
              padding: '0.5rem 1rem',
              borderRadius: '4px'
            }}>
              Current file: {fileName}
            </span>
          )}
        </div>
      </header>

      {/* 3D Viewer Canvas */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#ecf0f1', minHeight: 0 }}>
        {loading && <Loader />}
        
        <Canvas 
          camera={{ position: [0, 0, 5], fov: 50 }} 
          style={{ background: 'linear-gradient(to bottom, #3498db, #ecf0f1)', width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <directionalLight position={[-10, -10, -10]} intensity={0.5} />
          
          {mesh && (
            <mesh ref={meshRef} geometry={mesh}>
              <meshPhongMaterial 
                color="#3498db" 
                wireframe={false} 
                side={THREE.DoubleSide}
                shininess={60}
                transparent={true}
                opacity={0.9}
              />
            </mesh>
          )}
          
          {/* Grid for reference */}
          <Grid 
            position={[0, -1, 0]} 
            args={[10, 10]} 
            cellSize={0.5} 
            cellThickness={0.5} 
            cellColor="#666666" 
            sectionSize={1} 
            sectionThickness={1} 
            sectionColor="#888888" 
            fadeDistance={30} 
            fadeStrength={2} 
          />
          
          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#f0f0f0" transparent opacity={0.8} />
          </mesh>
          
          <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            minDistance={0.1}
            maxDistance={1000} // Much larger max distance to accommodate large models
            makeDefault // Make this the default camera controller
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: THREE.MOUSE.ZOOM
            }}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.ZOOM
            }}
          />
          <CameraController meshRef={meshRef} fitted={fitted} setFitted={setFitted} fileName={fileName} />
        </Canvas>
      </div>

      {/* Info panel */}
      <footer style={{ 
        padding: '0.5rem', 
        backgroundColor: '#2c3e50', 
        textAlign: 'center',
        color: 'white',
        fontSize: '0.9rem',
        flexShrink: 0
      }}>
        <p>
          {fileName ? `File: ${fileName}` : 'Upload an STL file to view it in 3D.'} 
          {' Drag to rotate, scroll to zoom, right-click to pan.'}
        </p>
      </footer>
    </div>
  );
}

export default STLViewer;
