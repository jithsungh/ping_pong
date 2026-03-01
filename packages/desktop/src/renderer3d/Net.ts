import * as THREE from 'three';

const TABLE_WIDTH = 1.525;
const TABLE_HEIGHT = 0.76;
const NET_HEIGHT = 0.1525; // 15.25cm
const POST_WIDTH = 0.02;
const POST_HEIGHT = NET_HEIGHT + 0.02;

export class Net {
  private group: THREE.Group;
  
  constructor() {
    this.group = new THREE.Group();
    this.createPosts();
    this.createMesh();
  }
  
  private createPosts(): void {
    // Metal posts on each side
    const postGeometry = new THREE.CylinderGeometry(POST_WIDTH / 2, POST_WIDTH / 2, POST_HEIGHT, 8);
    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.3,
      metalness: 0.8
    });
    
    // Left post
    const leftPost = new THREE.Mesh(postGeometry, postMaterial);
    leftPost.position.set(-TABLE_WIDTH / 2 - POST_WIDTH, TABLE_HEIGHT + POST_HEIGHT / 2, 0);
    leftPost.castShadow = true;
    this.group.add(leftPost);
    
    // Right post
    const rightPost = new THREE.Mesh(postGeometry, postMaterial);
    rightPost.position.set(TABLE_WIDTH / 2 + POST_WIDTH, TABLE_HEIGHT + POST_HEIGHT / 2, 0);
    rightPost.castShadow = true;
    this.group.add(rightPost);
    
    // Top bar connecting posts
    const barGeometry = new THREE.CylinderGeometry(0.005, 0.005, TABLE_WIDTH + POST_WIDTH * 2, 8);
    const bar = new THREE.Mesh(barGeometry, postMaterial);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, TABLE_HEIGHT + POST_HEIGHT, 0);
    this.group.add(bar);
  }
  
  private createMesh(): void {
    // Net mesh using a grid texture
    const netGeometry = new THREE.PlaneGeometry(TABLE_WIDTH + POST_WIDTH * 2, NET_HEIGHT, 20, 8);
    
    // Create simple net appearance with transparency
    const netMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      wireframe: false
    });
    
    const netMesh = new THREE.Mesh(netGeometry, netMaterial);
    netMesh.position.set(0, TABLE_HEIGHT + NET_HEIGHT / 2 + 0.01, 0);
    this.group.add(netMesh);
    
    // Add horizontal lines for net texture effect
    const lineCount = 6;
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
    
    for (let i = 0; i <= lineCount; i++) {
      const y = TABLE_HEIGHT + 0.01 + (NET_HEIGHT / lineCount) * i;
      const points = [
        new THREE.Vector3(-TABLE_WIDTH / 2 - POST_WIDTH, y, 0),
        new THREE.Vector3(TABLE_WIDTH / 2 + POST_WIDTH, y, 0)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      this.group.add(line);
    }
    
    // Add vertical lines
    const verticalCount = 30;
    for (let i = 0; i <= verticalCount; i++) {
      const x = -TABLE_WIDTH / 2 - POST_WIDTH + ((TABLE_WIDTH + POST_WIDTH * 2) / verticalCount) * i;
      const points = [
        new THREE.Vector3(x, TABLE_HEIGHT + 0.01, 0),
        new THREE.Vector3(x, TABLE_HEIGHT + NET_HEIGHT, 0)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      this.group.add(line);
    }
  }
  
  getMesh(): THREE.Group {
    return this.group;
  }
}
