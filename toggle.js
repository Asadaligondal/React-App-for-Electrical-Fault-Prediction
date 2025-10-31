#!/usr/bin/env node

// Toggle script for switching between fake and real data
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.js');

// Read current config
let configContent = fs.readFileSync(configPath, 'utf8');

// Check current mode
const currentMode = configContent.includes('USE_FAKE_DATA: true') ? 'fake' : 'real';

console.log(`🔄 Current mode: ${currentMode.toUpperCase()}`);

// Get desired mode from command line argument
const args = process.argv.slice(2);
const desiredMode = args[0];

if (!desiredMode || !['fake', 'real'].includes(desiredMode)) {
    console.log('📋 Usage:');
    console.log('  node toggle.js fake   - Switch to fake sensor data');
    console.log('  node toggle.js real   - Switch to real Raspberry Pi data');
    console.log('');
    console.log(`📊 Current mode: ${currentMode.toUpperCase()}`);
    process.exit(0);
}

// Toggle the setting
if (desiredMode === 'fake') {
    configContent = configContent.replace('USE_FAKE_DATA: false', 'USE_FAKE_DATA: true');
} else {
    configContent = configContent.replace('USE_FAKE_DATA: true', 'USE_FAKE_DATA: false');
}

// Write back to file
fs.writeFileSync(configPath, configContent);

console.log(`✅ Switched to ${desiredMode.toUpperCase()} data mode`);
console.log('🔄 Restart your services for changes to take effect:');
console.log('   1. Stop all running services (Ctrl+C)');
console.log('   2. node server.js');
console.log('   3. node server/startUDPService.js');
console.log('   4. cd ai-service && python app.py');
console.log('   5. npm start');