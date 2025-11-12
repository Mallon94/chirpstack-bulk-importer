import { DeviceServiceClient } from "@chirpstack/chirpstack-api-grpc-web/api/device_grpc_web_pb";
import {
  CreateDeviceRequest,
  Device,
  DeviceKeys,
  CreateDeviceKeysRequest,
} from "@chirpstack/chirpstack-api-grpc-web/api/device_pb";
import type { Metadata } from "grpc-web";

export interface DeviceData {
  device_name: string;
  deveui: string;
  app_key: string;
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

  async createDevice(
    applicationId: string,
    deviceName: string,
    devEui: string,
    deviceProfileId: string,
    appKey: string
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

    return new Promise((resolve, reject) => {
      this.client.create(request, this.metadata, (err, response) => {
        if (err) {
          reject(err);
        } else {
          // After creating the device, set the device keys
          this.createDeviceKeys(devEui, appKey)
            .then(() => resolve())
            .catch((keyErr) => reject(keyErr));
        }
      });
    });
  }

  async createDeviceKeys(devEui: string, appKey: string): Promise<void> {
    const deviceKeys = new DeviceKeys();
    deviceKeys.setDevEui(devEui);
    deviceKeys.setAppKey(appKey);

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

      try {
        await this.createDevice(
          applicationId,
          device.device_name,
          device.deveui,
          deviceProfileId,
          device.app_key
        );
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          device,
          error: error.message || "Unknown error",
        });
      }

      if (onProgress) {
        onProgress(i + 1, devices.length);
      }
    }

    return results;
  }
}
