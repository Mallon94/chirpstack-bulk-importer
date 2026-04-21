<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Type,
} from "lucide-vue-next";
import Button from "./ui/Button.vue";
import Card from "./ui/Card.vue";
import Alert from "./ui/Alert.vue";
import { ChirpStackClient, type DeviceData } from "@/services/chirpstack";
import { generateAppKeyFromDevEUI } from "@/lib/utils";

const fileInputRef = ref<HTMLInputElement | null>(null);
const textInput = ref("");
const uploadedFileName = ref("");
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
// Use '/api' for production (Nginx reverse proxy) or the configured URL for development
const chirpstackUrl = import.meta.env.VITE_CHIRPSTACK_URL || "/api";
const apiToken = import.meta.env.VITE_CHIRPSTACK_API_TOKEN || "";
const applicationId = ref(import.meta.env.VITE_CHIRPSTACK_APPLICATION_ID || "");
const deviceProfileId = ref(import.meta.env.VITE_CHIRPSTACK_DEVICE_PROFILE_ID || "");

const deviceCount = computed(() => devices.value.length);
// chirpstackUrl defaults to /api, so only check the other required fields
const isConfigured = computed(
  () => apiToken && applicationId.value && deviceProfileId.value
);

// Parse DevEUI text (from file or paste)
const parseDevEuiText = (text: string): DeviceData[] => {
  // Split by newlines and filter out empty lines
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Process each line as a DevEUI
  const validDevices: DeviceData[] = [];

  for (const devEui of lines) {
    const cleanDevEui = devEui.replace(/[^0-9A-Fa-f]/g, "");

    // Validate DevEUI (should be 16 hex characters)
    if (cleanDevEui.length !== 16) {
      continue;
    }

    const last5Digits = cleanDevEui.slice(-5).toUpperCase();

    validDevices.push({
      deveui: devEui,
      device_name: `BZ1-${last5Digits}`,
      app_key: generateAppKeyFromDevEUI(devEui),
    });
  }

  return validDevices;
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  uploadedFileName.value = file.name;
  uploadStatus.value = "parsing";
  errorMessage.value = "";
  devices.value = [];

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    const validDevices = parseDevEuiText(text);

    if (validDevices.length === 0) {
      errorMessage.value = "No valid DevEUI values found in file";
      uploadStatus.value = "error";
      return;
    }

    devices.value = validDevices;
    uploadStatus.value = "idle";
  };

  reader.onerror = () => {
    errorMessage.value = "Failed to read file";
    uploadStatus.value = "error";
  };

  reader.readAsText(file);
};

// Handle text paste
const handleTextInput = () => {
  if (!textInput.value.trim()) {
    devices.value = [];
    return;
  }

  uploadStatus.value = "parsing";
  errorMessage.value = "";
  uploadedFileName.value = "";

  const validDevices = parseDevEuiText(textInput.value);

  if (validDevices.length === 0) {
    errorMessage.value = "No valid DevEUI values found in text";
    uploadStatus.value = "error";
    return;
  }

  devices.value = validDevices;
  uploadStatus.value = "idle";
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
      applicationId.value,
      deviceProfileId.value,
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
  textInput.value = "";
  uploadedFileName.value = "";
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
    <div
      class="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50"
    ></div>
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.1),transparent_50%)]"
    ></div>
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(251,146,60,0.1),transparent_50%)]"
    ></div>

    <div class="relative z-10 p-8 pt-2">
      <div class="max-w-5xl mx-auto space-y-8">
        <!-- Header Section with animation -->
        <div class="text-center space-y-4 animate-fade-in py-8">
          <div class="inline-flex items-center justify-center mb-4">
            <img
              src="/beespace-logo.png"
              alt="beespace logo"
              class="h-16"
            />
          </div>
          <h1
            class="text-5xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent"
          >
            ChirpStack Bulk Importer
          </h1>
          <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
            Bulk Device Importer for LoRaWAN
          </p>
          <p class="text-sm text-muted-foreground">
            Seamlessly import your devices to beespace ChirpStack v4 server
          </p>
        </div>

        <!-- Configuration Inputs -->
        <Card class="shadow-xl border-0 bg-white/80 backdrop-blur-sm animate-slide-up">
          <div class="p-6 space-y-4">
            <div class="flex items-center gap-3 mb-2">
              <AlertCircle class="w-5 h-5 text-orange-600" />
              <h2 class="text-lg font-semibold text-foreground">ChirpStack Configuration</h2>
            </div>
            <div class="grid md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-sm font-medium text-foreground">Application ID</label>
                <input
                  v-model="applicationId"
                  type="text"
                  placeholder="e.g. d125de58-de82-4221-9330-a90c9676cb4d"
                  :disabled="isProcessing"
                  class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg font-mono text-sm transition-all duration-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-foreground">Device Profile ID</label>
                <input
                  v-model="deviceProfileId"
                  type="text"
                  placeholder="e.g. fa8c07e0-82f0-4243-9df1-2d8eab445f7a"
                  :disabled="isProcessing"
                  class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg font-mono text-sm transition-all duration-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <Alert v-if="!isConfigured" variant="destructive" class="shadow-sm">
              <AlertCircle class="h-4 w-4 inline mr-2" />
              Both Application ID and Device Profile ID are required to upload.
            </Alert>
          </div>
        </Card>

        <!-- Main Card -->
        <Card
          class="shadow-xl border-0 bg-white/80 backdrop-blur-sm animate-slide-up"
          style="animation-delay: 0.1s"
        >
          <div class="p-8 space-y-6">
            <!-- Instructions Section -->
            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"
                >
                  <FileText class="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 class="text-2xl font-semibold text-foreground">
                    DevEUI Input
                  </h2>
                  <p class="text-sm text-muted-foreground">
                    Upload a file or paste DevEUI values directly
                  </p>
                </div>
              </div>

              <div class="space-y-2">
                <p class="text-sm font-medium text-foreground">
                  Format: One DevEUI per line
                </p>
                <div
                  class="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200 font-mono text-xs leading-relaxed"
                >
                  8C1F6443F0000013<br />
                  8C1F6443F0000014<br />
                  8C1F6443F0000017
                </div>
              </div>
              <div class="mt-3 text-xs text-muted-foreground space-y-1">
                <p>✓ Just list DevEUI values - one per line</p>
                <p>
                  ✓ Device names auto-generated as
                  <strong>BZ1-{last 5 digits}</strong>
                </p>
                <p>✓ AppKeys automatically derived from DevEUI</p>
              </div>
            </div>

            <div
              class="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"
            ></div>

            <!-- Input Section -->
            <div class="space-y-4">
              <div class="grid md:grid-cols-2 gap-4">
                <!-- File Upload Area -->
                <div class="relative group">
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".txt,.csv"
                    class="hidden"
                    @change="handleFileChange"
                    :disabled="isProcessing"
                  />
                  <div
                    @click="triggerFileInput"
                    class="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 hover:border-orange-400 hover:bg-orange-50/50 group-hover:shadow-lg h-full flex flex-col justify-center"
                    :class="{ 'opacity-50 cursor-not-allowed': isProcessing }"
                  >
                    <div
                      class="transition-transform duration-300 group-hover:scale-110"
                    >
                      <Upload class="mx-auto h-12 w-12 text-orange-400 mb-3" />
                    </div>
                    <p class="text-base font-medium text-foreground mb-1">
                      {{ uploadedFileName ? uploadedFileName : "Upload File" }}
                    </p>
                    <p class="text-xs text-muted-foreground">.txt or .csv</p>
                  </div>
                </div>

                <!-- Text Paste Area -->
                <div class="relative">
                  <div class="flex items-center gap-2 mb-2">
                    <Type class="w-4 h-4 text-orange-600" />
                    <label class="text-sm font-medium text-foreground"
                      >Or Paste DevEUI List</label
                    >
                  </div>
                  <textarea
                    v-model="textInput"
                    @input="handleTextInput"
                    :disabled="isProcessing"
                    placeholder="8C1F6443F0000013&#10;8C1F6443F0000014&#10;8C1F6443F0000017"
                    class="w-full h-[160px] p-4 border-2 border-gray-300 rounded-xl font-mono text-sm resize-none transition-all duration-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  ></textarea>
                </div>
              </div>

              <!-- Device Count Alert -->
              <transition
                enter-active-class="transition duration-300"
                enter-from-class="opacity-0 transform scale-95"
                enter-to-class="opacity-100 transform scale-100"
              >
                <Alert
                  v-if="deviceCount > 0"
                  variant="success"
                  class="shadow-md"
                >
                  <CheckCircle class="h-5 w-5 inline mr-2" />
                  Found
                  <strong class="text-lg">{{ deviceCount }}</strong> device(s)
                  ready for import
                </Alert>
              </transition>

              <!-- Error Alert -->
              <transition
                enter-active-class="transition duration-300"
                enter-from-class="opacity-0 transform scale-95"
                enter-to-class="opacity-100 transform scale-100"
              >
                <Alert
                  v-if="errorMessage && uploadStatus !== 'success'"
                  variant="destructive"
                  class="shadow-md"
                >
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
                <div
                  v-if="uploadStatus === 'uploading'"
                  class="space-y-3 p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200"
                >
                  <div
                    class="flex justify-between items-center text-sm font-medium"
                  >
                    <span class="text-orange-700">Uploading devices...</span>
                    <span class="text-orange-600"
                      >{{ currentProgress }} / {{ totalProgress }}</span
                    >
                  </div>
                  <div
                    class="w-full bg-white rounded-full h-3 overflow-hidden shadow-inner"
                  >
                    <div
                      class="bg-gradient-to-r from-orange-500 to-amber-600 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                      :style="{
                        width: `${(currentProgress / totalProgress) * 100}%`,
                      }"
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
                <Alert v-if="uploadStatus === 'success'" variant="success" class="shadow-lg">
                  <CheckCircle class="h-5 w-5 inline mr-2" />
                  Successfully registered
                  <strong>{{ successCount }}</strong> device(s)
                  <span v-if="failedCount > 0" class="text-orange-600">
                    - {{ failedCount }} failed</span
                  >
                </Alert>
              </transition>

              <!-- Failed Devices List (shown for both partial and full failure) -->
              <transition
                enter-active-class="transition duration-300"
                enter-from-class="opacity-0 transform scale-95"
                enter-to-class="opacity-100 transform scale-100"
              >
                <div
                  v-if="uploadErrors.length > 0 && (uploadStatus === 'success' || uploadStatus === 'error')"
                  class="mt-4 p-4 bg-red-50 rounded-xl border border-red-200"
                >
                  <h3
                    class="font-semibold text-red-800 mb-3 flex items-center gap-2"
                  >
                    <XCircle class="w-4 h-4" />
                    Failed Devices
                  </h3>
                  <div class="space-y-2 max-h-60 overflow-y-auto">
                    <div
                      v-for="(error, index) in uploadErrors"
                      :key="index"
                      class="text-sm bg-white p-3 rounded-lg shadow-sm"
                    >
                      <strong class="text-red-700">{{
                        error.device.device_name
                      }}</strong>
                      <span class="text-gray-500">
                        ({{ error.device.deveui }})</span
                      >
                      <p class="text-red-600 mt-1">{{ error.error }}</p>
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
                  <Upload class="w-5 h-5 mr-2" />
                  {{ isProcessing ? "Uploading..." : "Upload to ChirpStack" }}
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
        <div
          class="text-center text-sm text-muted-foreground animate-fade-in"
          style="animation-delay: 0.3s"
        >
          <p>Powered by ChirpStack v4 gRPC API</p>
        </div>
      </div>
    </div>
  </div>
</template>
