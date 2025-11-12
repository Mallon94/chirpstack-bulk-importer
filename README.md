# ChirpStack Bulk Device Importer

A Vue 3 web application for bulk importing LoRaWAN devices to ChirpStack v4 via gRPC.

## Features

- 📁 CSV file upload for bulk device import
- 🔢 Automatic device count detection
- 📊 Real-time upload progress tracking
- ✅ Success/failure reporting
- 🎨 Modern UI with shadcn-vue components
- 🔐 Secure configuration via environment variables

## Prerequisites

- Node.js 18+ and npm
- ChirpStack v4 server with gRPC-web enabled
- ChirpStack API token with device creation permissions

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd chirpstack-bulk-importer
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and fill in your ChirpStack server details:
```env
VITE_CHIRPSTACK_URL=https://your-chirpstack-server:8080
VITE_CHIRPSTACK_API_TOKEN=your-api-token
VITE_CHIRPSTACK_APPLICATION_ID=your-application-uuid
VITE_CHIRPSTACK_DEVICE_PROFILE_ID=your-device-profile-uuid
```

4. Start the development server:
```bash
npm run dev
```

## CSV File Format

Your CSV file must include the following headers:

```csv
device_name,deveui
Sensor-01,0102030405060708
Sensor-02,0102030405060709
Sensor-03,010203040506070A
```

**Required columns:**
- `device_name`: The name of the device
- `deveui`: The device EUI (16 hex characters)

## Usage

1. Open the application in your browser
2. Click "Select CSV File" and choose your prepared CSV file
3. The application will parse the file and display the device count
4. Click "Upload to ChirpStack" to start the registration process
5. Monitor the progress bar and view results

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technology Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **shadcn-vue** - UI component library
- **Tailwind CSS** - Utility-first CSS framework
- **ChirpStack gRPC-web** - ChirpStack API client
- **PapaParse** - CSV parsing library

## License

MIT
