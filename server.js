const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const tcpClients = {};
const net = require('net');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const dataPath = 'D:/Projects/scanner/data'; // Update with the correct path to the data directory
const scannersFile = `${dataPath}/scanners.json`;

let dataStore = {
  servers: [],
  data: [],
  dataPath: dataPath
};

// Load the scanners from the file if it exists
if (fs.existsSync(scannersFile)) {
  const scannersData = fs.readFileSync(scannersFile, 'utf8');
  try {
    dataStore.servers = JSON.parse(scannersData);
  } catch (error) {
    console.error(`Error parsing scanners data from file: ${error.message}`);
  }
}

app.get('/admin', (req, res) => {
  res.render('admin', { servers: dataStore.servers });
});

app.post('/admin', (req, res) => {
  const { name, ip, port } = req.body;

  // Validate user input
  if (!name || !ip || !port) {
    res.status(400).send('Invalid input');
    return;
  }

  // Connect to TCP server
  const client = new net.Socket();

  client.on('error', (error) => {
    console.error(`Error connecting to TCP Server: ${error.message}`);
    // Optionally, you can handle the error and provide a user-friendly message
    res.status(500).send('Error connecting to TCP Server');
  });

  client.connect(port, ip, () => {
    console.log('Connected to TCP Server');
  });

  client.on('data', (data) => {
    // Capture and sanitize the data before storing
    const sanitizedData = sanitizeHtml(data.toString());
    dataStore.data.push({ server: name, data: sanitizedData });
  });

  client.on('close', () => {
    console.log('TCP Connection closed');
    // Remove the server from the dataStore when the connection is closed
    const serverIndex = dataStore.servers.findIndex((server) => server.name === name);
    if (serverIndex !== -1) {
      dataStore.servers.splice(serverIndex, 1);
    }
  });

  tcpClients[name] = client;
  dataStore.servers.push({ name, ip, port });

  // Save the updated scanners to the file
  fs.writeFileSync(scannersFile, JSON.stringify(dataStore.servers), 'utf8', (error) => {
    if (error) {
      console.error(`Error writing scanners data to file: ${error.message}`);
    }
  });

  res.redirect('/admin');
});

app.get('/users', (req, res) => {
  res.render('users', { servers: dataStore.servers, data: dataStore.data });
});

// Gracefully close TCP connections and server on shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  Object.values(tcpClients).forEach((client) => {
    client.end();
  });
  process.exit(0);
});

app.listen(3000, () => {
  console.log('App is listening on port 3000');
});
