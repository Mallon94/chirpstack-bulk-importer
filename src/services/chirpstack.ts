import { DeviceServiceClient } from "@chirpstack/chirpstack-api-grpc-web/api/device_grpc_web_pb";
import {
  CreateDeviceRequest,
  Device,
  DeviceKeys,
  CreateDeviceKeysRequest,
} from "@chirpstack/chirpstack-api-grpc-web/api/device_pb";
import type { Metadata } from "grpc-web";
import { generateAppKeyFromDevEUI } from "@/lib/utils";

export interface DeviceData {
  device_name?: string; // Optional - will be auto-generated from DevEUI if not provided
  deveui: string;
  app_key?: string; // Optional - will be auto-generated if not provided
}

export class ChirpStackClient {
  private client: DeviceServiceClient;
  private metadata: Metadata;

  constructor(serverUrl: string, apiToken: string) {
    this.client = new DeviceServiceClient(serverUrl);
    this.metadata = {
      authorization: `Bearer ${apiToken}`,
    };
  }

  async createDeviceKeys(devEui: string, appKey: string): Promise<void> {
    const deviceKeys = new DeviceKeys();
    deviceKeys.setDevEui(devEui);
    deviceKeys.setNwkKey(appKey); // For LoRaWAN 1.1+
    deviceKeys.setAppKey(appKey); // For LoRaWAN 1.0.x compatibility

    const request = new CreateDeviceKeysRequest();
    request.setDeviceKeys(deviceKeys);

    return new Promise((resolve, reject) => {
      this.client.createKeys(request, this.metadata, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async createDevice(
    applicationId: string,
    deviceName: string,
    devEui: string,
    deviceProfileId: string,
    appKey?: string
  ): Promise<void> {
    const device = new Device();
    device.setName(deviceName);
    device.setDevEui(devEui);
    device.setApplicationId(applicationId);
    device.setDeviceProfileId(deviceProfileId);
    device.setJoinEui("8C1F6443F9999999");
    device.setDescription(`Imported device: ${deviceName}`);

    const request = new CreateDeviceRequest();
    request.setDevice(device);

    // Create the device
    await new Promise<void>((resolve, reject) => {
      this.client.create(request, this.metadata, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Generate AppKey if not provided, then set device keys
    const finalAppKey = appKey || generateAppKeyFromDevEUI(devEui);
    await this.createDeviceKeys(devEui, finalAppKey);
  }

  async registerDevices(
    applicationId: string,
    deviceProfileId: string,
    devices: DeviceData[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ device: DeviceData; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ device: DeviceData; error: string }>,
    };

    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      if (!device) continue;

      // Generate device_name from last 5 digits of DevEUI if not provided
      const deviceName = device.device_name ||
        `BZ1-${device.deveui.replace(/[^0-9A-Fa-f]/g, '').slice(-5).toUpperCase()}`;

      try {
        await this.createDevice(
          applicationId,
          deviceName,
          device.deveui,
          deviceProfileId,
          device.app_key
        );
        results.success++;
      } catch (error: any) {
        console.error(`Failed to register device ${device.deveui}: code=${error.code} message=${error.message}`, JSON.stringify(error));
        results.failed++;
        results.errors.push({
          device,
          error: error.message || (error.code !== undefined ? `gRPC error code ${error.code}` : "Unknown error"),
        });
      }

      if (onProgress) {
        onProgress(i + 1, devices.length);
      }
    }

    return results;
  }
}
