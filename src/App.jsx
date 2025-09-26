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

// Component to adjust camera based on model size
function CameraController({ modelSize, modelCenter, fitted, setFitted }) {
  const { camera } = useThree();
  
  useEffect(() => {
    if (modelSize && modelCenter && !fitted) {
      // Calculate the maximum dimension to determine camera distance
      const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
      // Calculate distance based on model size to fit in view
      const distance = maxDim * 2.5; // Adjust this multiplier as needed
      
      // Position the camera to look at the center of the model
      camera.position.set(distance, distance, distance);
      camera.lookAt(0, 0, 0); // Look at origin since model is centered there
      camera.updateProjectionMatrix();
      
      // Mark as fitted to prevent repeated adjustments
      setTimeout(() => setFitted(true), 100); // Small delay to ensure update
    }
  }, [modelSize, modelCenter, fitted, camera, setFitted]);

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
  const [modelSize, setModelSize] = useState(null);
  const [modelCenter, setModelCenter] = useState(null);
  const [fitted, setFitted] = useState(false);
  const fileInputRef = useRef(null);

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
        
        // Calculate model size and center for auto-adjusting camera
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if (box) {
          const size = new THREE.Vector3();
          box.getSize(size);
          setModelSize(size);
          
          const center = new THREE.Vector3();
          box.getCenter(center);
          setModelCenter(center);
        }
        
        setMesh(geometry);
        setFitted(false); // Reset fitted flag
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

  // Reset fitted flag when a new model is loaded
  useEffect(() => {
    if (modelSize && modelCenter) {
      setFitted(false);
    }
  }, [modelSize, modelCenter]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          <CameraController modelSize={modelSize} modelCenter={modelCenter} fitted={fitted} setFitted={setFitted} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <directionalLight position={[-10, -10, -10]} intensity={0.5} />
          
          {mesh && (
            <mesh geometry={mesh} position={[-(modelCenter?.x || 0), -(modelCenter?.y || 0), -(modelCenter?.z || 0) ]}>
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
            minDistance={1}
            maxDistance={20}
          />
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
