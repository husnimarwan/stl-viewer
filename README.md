# STL File Viewer

A 3D STL file viewer built with React, Vite, and Three.js. This application allows you to upload and visualize STL files in a web browser with an intuitive 3D interface.

## Features

- **STL File Upload**: Supports both binary and ASCII STL file formats
- **Automatic Scaling**: Automatically adjusts camera to fit models of any size within the view
- **Interactive Navigation**: 
  - Left mouse: Rotate the model
  - Middle mouse: Pan the view
  - Right mouse: Zoom in/out
  - Touch controls for mobile devices (one finger to rotate, two fingers to zoom)
- **Responsive Design**: Fills the entire browser window with no whitespace
- **Real-time Rendering**: Smooth 3D rendering using Three.js and React Three Fiber
- **Visual Reference**: Grid and ground plane for spatial context
- **Loading Progress**: Visual feedback during file loading

## Technologies

- React 19
- Vite 7
- Three.js
- @react-three/fiber
- @react-three/drei
- JavaScript/ES6+

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone or download the repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

### Running the Application

```bash
npm run dev
```

The application will start at `http://localhost:5173` (or another available port).

## Usage

1. Click the "Upload STL File" button
2. Select an STL file from your computer
3. The 3D model will automatically appear in the viewer with proper scaling
4. Use the mouse controls to navigate around the model:
   - Left-click and drag to rotate
   - Middle-click and drag to pan
   - Right-click and drag to zoom
   - Mouse wheel to zoom in/out

## Project Structure

```
src/
├── App.jsx           # Main application component
├── App.css          # Application styles
├── index.css        # Global styles
├── main.jsx         # React entry point
└── assets/          # Static assets
```

## Dependencies

- `react`: JavaScript library for building user interfaces
- `react-dom`: React package for DOM manipulation
- `three`: JavaScript 3D library
- `@react-three/fiber`: React renderer for Three.js
- `@react-three/drei`: Useful helpers for React Three Fiber

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
