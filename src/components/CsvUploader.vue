<script setup lang="ts">
import { ref, computed } from "vue";
import Papa from "papaparse";
import { Upload, CheckCircle, XCircle, AlertCircle, FileText, Zap } from "lucide-vue-next";
import Button from "./ui/Button.vue";
import Card from "./ui/Card.vue";
import Alert from "./ui/Alert.vue";
import { ChirpStackClient, type DeviceData } from "@/services/chirpstack";
import { generateAppKeyFromDevEUI } from "@/lib/utils";

const fileInputRef = ref<HTMLInputElement | null>(null);
const csvFile = ref<File | null>(null);
const devices = ref<DeviceData[]>([]);
const isProcessing = ref(false);
const uploadStatus = ref<
  "idle" | "parsing" | "uploading" | "success" | "error"
>("idle");
const errorMessage = ref("");
const successCount = ref(0);
const failedCount = ref(0);
const currentProgress = ref(0);
const totalProgress = ref(0);
const uploadErrors = ref<Array<{ device: DeviceData; error: string }>>([]);

// Configuration from environment variables
const chirpstackUrl = import.meta.env.VITE_CHIRPSTACK_URL || "";
const apiToken = import.meta.env.VITE_CHIRPSTACK_API_TOKEN || "";
const applicationId = import.meta.env.VITE_CHIRPSTACK_APPLICATION_ID || "";
const deviceProfileId = import.meta.env.VITE_CHIRPSTACK_DEVICE_PROFILE_ID || "";

const deviceCount = computed(() => devices.value.length);
const isConfigured = computed(
  () => chirpstackUrl && apiToken && applicationId && deviceProfileId
);

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  csvFile.value = file;
  uploadStatus.value = "parsing";
  errorMessage.value = "";
  devices.value = [];

  Papa.parse<DeviceData>(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.errors.length > 0) {
        const firstError = results.errors[0];
        errorMessage.value = `CSV parsing error: ${
          firstError?.message || "Unknown error"
        }`;
        uploadStatus.value = "error";
        return;
      }

      // Check if headers contain 'deveui'
      const headers = results.meta.fields || [];
      const hasDevEuiHeader = headers.some(h => h && h.toLowerCase().includes("deveui"));

      // If no deveui header found, re-parse as headerless CSV
      if (!hasDevEuiHeader) {
        Papa.parse<string[]>(file, {
          header: false,
          skipEmptyLines: true,
          complete: (headerlessResults) => {
            if (headerlessResults.errors.length > 0) {
              const firstError = headerlessResults.errors[0];
              errorMessage.value = `CSV parsing error: ${
                firstError?.message || "Unknown error"
              }`;
              uploadStatus.value = "error";
              return;
            }

            // Process each row as a DevEUI (first column)
            const validDevices = headerlessResults.data
              .filter((row) => {
                return row && row[0] && row[0].trim() !== "";
              })
              .map((row) => {
                const devEui = row[0]!.trim();
                const cleanDevEui = devEui.replace(/[^0-9A-Fa-f]/g, '');
                const last5Digits = cleanDevEui.slice(-5).toUpperCase();

                return {
                  deveui: devEui,
                  device_name: `BZ1-${last5Digits}`,
                  app_key: generateAppKeyFromDevEUI(devEui)
                };
              });

            if (validDevices.length === 0) {
              errorMessage.value = "No valid devices found in CSV";
              uploadStatus.value = "error";
              return;
            }

            devices.value = validDevices;
            uploadStatus.value = "idle";
          },
          error: (error) => {
            errorMessage.value = `Failed to parse CSV: ${error.message}`;
            uploadStatus.value = "error";
          }
        });
        return;
      }

      // Process with headers
      const validDevices = results.data
        .filter((device) => {
          return device.deveui && device.deveui.trim() !== "";
        })
        .map((device) => {
          // Auto-generate device_name from last 5 digits of DevEUI
          const cleanDevEui = device.deveui.replace(/[^0-9A-Fa-f]/g, '');
          const last5Digits = cleanDevEui.slice(-5).toUpperCase();
          device.device_name = `BZ1-${last5Digits}`;

          // Auto-generate app_key from DevEUI if not provided
          if (!device.app_key || device.app_key.trim() === "") {
            device.app_key = generateAppKeyFromDevEUI(device.deveui);
          }
          return device;
        });

      if (validDevices.length === 0) {
        errorMessage.value = "No valid devices found in CSV";
        uploadStatus.value = "error";
        return;
      }

      devices.value = validDevices;
      uploadStatus.value = "idle";
    },
    error: (error) => {
      errorMessage.value = `Failed to parse CSV: ${error.message}`;
      uploadStatus.value = "error";
    },
  });
};

const uploadDevices = async () => {
  if (!isConfigured.value) {
    errorMessage.value =
      "ChirpStack configuration is missing. Please check your .env file.";
    uploadStatus.value = "error";
    return;
  }

  if (devices.value.length === 0) {
    errorMessage.value = "No devices to upload";
    return;
  }

  isProcessing.value = true;
  uploadStatus.value = "uploading";
  errorMessage.value = "";
  successCount.value = 0;
  failedCount.value = 0;
  uploadErrors.value = [];

  try {
    const client = new ChirpStackClient(chirpstackUrl, apiToken);

    const results = await client.registerDevices(
      applicationId,
      deviceProfileId,
      devices.value,
      (current, total) => {
        currentProgress.value = current;
        totalProgress.value = total;
      }
    );

    successCount.value = results.success;
    failedCount.value = results.failed;
    uploadErrors.value = results.errors;

    if (results.failed === 0) {
      uploadStatus.value = "success";
    } else if (results.success === 0) {
      uploadStatus.value = "error";
      errorMessage.value = "All devices failed to register";
    } else {
      uploadStatus.value = "success";
      errorMessage.value = `${results.success} devices registered, ${results.failed} failed`;
    }
  } catch (error: any) {
    uploadStatus.value = "error";
    errorMessage.value = error.message || "Failed to upload devices";
  } finally {
    isProcessing.value = false;
  }
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const reset = () => {
  csvFile.value = null;
  devices.value = [];
  uploadStatus.value = "idle";
  errorMessage.value = "";
  successCount.value = 0;
  failedCount.value = 0;
  currentProgress.value = 0;
  totalProgress.value = 0;
  uploadErrors.value = [];
  if (fileInputRef.value) {
    fileInputRef.value.value = "";
  }
};
</script>

<template>
  <div class="min-h-screen relative overflow-hidden">
    <!-- Elegant gradient background -->
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.1),transparent_50%)]"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.1),transparent_50%)]"></div>

    <div class="relative z-10 p-8">
      <div class="max-w-5xl mx-auto space-y-8">
        <!-- Header Section with animation -->
        <div class="text-center space-y-4 animate-fade-in py-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 mb-4">
            <Zap class="w-10 h-10 text-white" />
          </div>
          <h1 class="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            beespace ChirpStack
          </h1>
          <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
            Bulk Device Importer for LoRaWAN
          </p>
          <p class="text-sm text-muted-foreground">
            Seamlessly import your devices to beespace ChirpStack v4 server
          </p>
        </div>

        <!-- Configuration Warning -->
        <div v-if="!isConfigured" class="animate-slide-up">
          <Alert variant="destructive" class="shadow-lg">
            <AlertCircle class="h-5 w-5 inline mr-2" />
            <strong>Configuration Missing:</strong> Please configure your environment variables in the .env file
          </Alert>
        </div>

        <!-- Main Card -->
        <Card class="shadow-xl border-0 bg-white/80 backdrop-blur-sm animate-slide-up" style="animation-delay: 0.1s">
          <div class="p-8 space-y-6">
            <!-- Instructions Section -->
            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <FileText class="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 class="text-2xl font-semibold text-foreground">CSV Format</h2>
                  <p class="text-sm text-muted-foreground">Simple and flexible - with or without headers</p>
                </div>
              </div>

              <div class="grid md:grid-cols-2 gap-4">
                <!-- Required Format -->
                <div class="space-y-2">
                  <p class="text-sm font-medium text-foreground">Option 1: With Header</p>
                  <div class="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 font-mono text-xs leading-relaxed">
                    <span class="text-purple-600">deveui</span><br />
                    8C1F6443F0000013<br />
                    8C1F6443F0000014
                  </div>
                </div>

                <!-- Example -->
                <div class="space-y-2">
                  <p class="text-sm font-medium text-foreground">Option 2: Without Header</p>
                  <div class="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-200 font-mono text-xs leading-relaxed">
                    8C1F6443F0000013<br />
                    8C1F6443F0000014<br />
                    8C1F6443F0000017
                  </div>
                </div>
              </div>
              <div class="mt-3 text-xs text-muted-foreground space-y-1">
                <p>✓ Headers are optional - just list DevEUI values</p>
                <p>✓ Device names auto-generated as <strong>BZ1-{last 5 digits}</strong></p>
                <p>✓ AppKeys automatically derived from DevEUI</p>
              </div>
            </div>

            <div class="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

            <!-- Upload Section -->
            <div class="space-y-4">
              <!-- File Upload Area -->
              <div class="relative group">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".csv"
                  class="hidden"
                  @change="handleFileChange"
                  :disabled="isProcessing"
                />
                <div
                  @click="triggerFileInput"
                  class="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 hover:border-indigo-400 hover:bg-indigo-50/50 group-hover:shadow-lg"
                  :class="{ 'opacity-50 cursor-not-allowed': isProcessing }"
                >
                  <div class="transition-transform duration-300 group-hover:scale-110">
                    <Upload class="mx-auto h-16 w-16 text-indigo-400 mb-4" />
                  </div>
                  <p class="text-lg font-medium text-foreground mb-2">
                    {{ csvFile ? csvFile.name : 'Click to select CSV file' }}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    or drag and drop your file here
                  </p>
                </div>
              </div>

              <!-- Device Count Alert -->
              <transition
                enter-active-class="transition duration-300"
                enter-from-class="opacity-0 transform scale-95"
                enter-to-class="opacity-100 transform scale-100"
              >
                <Alert v-if="deviceCount > 0" variant="success" class="shadow-md">
                  <CheckCircle class="h-5 w-5 inline mr-2" />
                  Found <strong class="text-lg">{{ deviceCount }}</strong> device(s) ready for import
                </Alert>
              </transition>

              <!-- Error Alert -->
              <transition
                enter-active-class="transition duration-300"
                enter-from-class="opacity-0 transform scale-95"
                enter-to-class="opacity-100 transform scale-100"
              >
                <Alert v-if="errorMessage && uploadStatus !== 'success'" variant="destructive" class="shadow-md">
                  <XCircle class="h-5 w-5 inline mr-2" />
                  {{ errorMessage }}
                </Alert>
              </transition>

              <!-- Upload Progress -->
              <transition
                enter-active-class="transition duration-300"
                enter-from-class="opacity-0 transform -translate-y-2"
                enter-to-class="opacity-100 transform translate-y-0"
              >
                <div v-if="uploadStatus === 'uploading'" class="space-y-3 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                  <div class="flex justify-between items-center text-sm font-medium">
                    <span class="text-indigo-700">Uploading devices...</span>
                    <span class="text-indigo-600">{{ currentProgress }} / {{ totalProgress }}</span>
                  </div>
                  <div class="w-full bg-white rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      class="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                      :style="{ width: `${(currentProgress / totalProgress) * 100}%` }"
                    />
                  </div>
                </div>
              </transition>

              <!-- Success Message -->
              <transition
                enter-active-class="transition duration-300"
                enter-from-class="opacity-0 transform scale-95"
                enter-to-class="opacity-100 transform scale-100"
              >
                <div v-if="uploadStatus === 'success'" class="space-y-4">
                  <Alert variant="success" class="shadow-lg">
                    <CheckCircle class="h-5 w-5 inline mr-2" />
                    Successfully registered <strong>{{ successCount }}</strong> device(s)
                    <span v-if="failedCount > 0" class="text-orange-600"> - {{ failedCount }} failed</span>
                  </Alert>

                  <!-- Error List -->
                  <div v-if="uploadErrors.length > 0" class="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                    <h3 class="font-semibold text-red-800 mb-3 flex items-center gap-2">
                      <XCircle class="w-4 h-4" />
                      Failed Devices
                    </h3>
                    <div class="space-y-2 max-h-60 overflow-y-auto">
                      <div
                        v-for="(error, index) in uploadErrors"
                        :key="index"
                        class="text-sm bg-white p-3 rounded-lg shadow-sm"
                      >
                        <strong class="text-red-700">{{ error.device.device_name }}</strong>
                        <span class="text-gray-500"> ({{ error.device.deveui }})</span>
                        <p class="text-red-600 mt-1">{{ error.error }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>

              <!-- Action Buttons -->
              <div class="flex gap-4 pt-4">
                <Button
                  @click="uploadDevices"
                  :disabled="deviceCount === 0 || isProcessing || !isConfigured"
                  class="flex-1 h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Zap class="w-5 h-5 mr-2" />
                  {{ isProcessing ? 'Uploading...' : 'Upload to ChirpStack' }}
                </Button>
                <Button
                  @click="reset"
                  variant="outline"
                  :disabled="isProcessing"
                  class="h-12 px-6 shadow-md hover:shadow-lg transition-all duration-300"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <!-- Footer -->
        <div class="text-center text-sm text-muted-foreground animate-fade-in" style="animation-delay: 0.3s">
          <p>Powered by ChirpStack v4 gRPC API</p>
        </div>
      </div>
    </div>
  </div>
</template>
