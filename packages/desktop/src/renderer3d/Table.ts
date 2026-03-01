import * as THREE from 'three';

// Real table tennis table dimensions in meters
const TABLE_LENGTH = 2.74;
const TABLE_WIDTH = 1.525;
const TABLE_HEIGHT = 0.76;
const TABLE_THICKNESS = 0.03;
const LEG_SIZE = 0.06;

export class Table {
  private group: THREE.Group;
  
  constructor() {
    this.group = new THREE.Group();
    this.createTableTop();
    this.createLegs();
    this.createLines();
  }
  
  private createTableTop(): void {
    // Table surface
    const geometry = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_THICKNESS, TABLE_LENGTH);
    const material = new THREE.MeshStandardMaterial({
      color: 0x006400, // Dark green
      roughness: 0.3,
      metalness: 0.1
    });
    
    const tableTop = new THREE.Mesh(geometry, material);
    tableTop.position.y = TABLE_HEIGHT;
    tableTop.receiveShadow = true;
    tableTop.castShadow = true;
    
    this.group.add(tableTop);
  }
  
  private createLegs(): void {
    const legGeometry = new THREE.BoxGeometry(LEG_SIZE, TABLE_HEIGHT - TABLE_THICKNESS / 2, LEG_SIZE);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d1b0e, // Dark brown wood
      roughness: 0.7,
      metalness: 0.0
    });
    
    const legPositions = [
      { x: -TABLE_WIDTH / 2 + LEG_SIZE, z: -TABLE_LENGTH / 2 + LEG_SIZE },
      { x: TABLE_WIDTH / 2 - LEG_SIZE, z: -TABLE_LENGTH / 2 + LEG_SIZE },
      { x: -TABLE_WIDTH / 2 + LEG_SIZE, z: TABLE_LENGTH / 2 - LEG_SIZE },
      { x: TABLE_WIDTH / 2 - LEG_SIZE, z: TABLE_LENGTH / 2 - LEG_SIZE }
    ];
    
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(pos.x, (TABLE_HEIGHT - TABLE_THICKNESS / 2) / 2, pos.z);
      leg.castShadow = true;
      this.group.add(leg);
    });
  }
  
  private createLines(): void {
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lineWidth = 0.02;
    const lineHeight = 0.001; // Slightly above table
    
    // Outer border
    const borderPositions = [
      // Front edge
      { x: 0, z: TABLE_LENGTH / 2, width: TABLE_WIDTH, depth: lineWidth },
      // Back edge
      { x: 0, z: -TABLE_LENGTH / 2, width: TABLE_WIDTH, depth: lineWidth },
      // Left edge
      { x: -TABLE_WIDTH / 2, z: 0, width: lineWidth, depth: TABLE_LENGTH },
      // Right edge
      { x: TABLE_WIDTH / 2, z: 0, width: lineWidth, depth: TABLE_LENGTH }
    ];
    
    borderPositions.forEach(pos => {
      const lineGeo = new THREE.BoxGeometry(pos.width, lineHeight, pos.depth);
      const line = new THREE.Mesh(lineGeo, lineMaterial);
      line.position.set(pos.x, TABLE_HEIGHT + TABLE_THICKNESS / 2 + lineHeight / 2, pos.z);
      this.group.add(line);
    });
    
    // Center line (for doubles, but good visual)
    const centerLineGeo = new THREE.BoxGeometry(lineWidth, lineHeight, TABLE_LENGTH);
    const centerLine = new THREE.Mesh(centerLineGeo, lineMaterial);
    centerLine.position.set(0, TABLE_HEIGHT + TABLE_THICKNESS / 2 + lineHeight / 2, 0);
    this.group.add(centerLine);
  }
  
  getMesh(): THREE.Group {
    return this.group;
  }
}
