const ModbusRTU = require("modbus-serial");

const client = new ModbusRTU();
const MODBUS_IP = "192.168.1.35";
const MODBUS_PORT = 502;

// Function to convert two 16-bit registers back to double (IEEE 754)
function registers_to_double(reg_high, reg_low) {
    const combined = (BigInt(reg_high) << 16n) | BigInt(reg_low);
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64BE(combined << 32n, 0);
    return buffer.readDoubleLE(0);
}

async function readVoltageData() {
    try {
        await client.connectTCP(MODBUS_IP, { port: MODBUS_PORT });
        client.setID(1);
        
        // Read 3 registers: reg0 (high), reg1 (low), reg2 (scaled)
        const data = await client.readHoldingRegisters(0, 3);
        
        // Method 1: Convert IEEE 754 format (registers 0 and 1)
        const voltage_ieee = registers_to_double(data.data[0], data.data[1]);
        
        // Method 2: Use scaled integer (register 2)
        const voltage_scaled = data.data[2] / 1000.0;
        
        // Display in same format as Raspberry Pi
        console.log(`Live voltage: ${voltage_scaled.toFixed(6)} V`);
        
        // Optional: Show both methods for comparison
        // console.log(`IEEE754 voltage: ${voltage_ieee.toFixed(6)} V`);
        // console.log(`Scaled voltage: ${voltage_scaled.toFixed(6)} V`);
        // console.log(`Raw registers: [${data.data[0]}, ${data.data[1]}, ${data.data[2]}]`);
        
        client.close();
        return voltage_scaled;
        
    } catch (error) {
        console.error("Error reading voltage:", error.message);
        return null;
    }
}

// Read voltage every 1 second (matching Pi's live monitoring frequency)
setInterval(readVoltageData, 10);

console.log(`Starting Modbus client for ${MODBUS_IP}:${MODBUS_PORT}`);
console.log("Reading voltage data from Raspberry Pi ADC...");
readVoltageData();