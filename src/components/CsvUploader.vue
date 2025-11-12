<script setup lang="ts">
import { ref, computed } from 'vue'
import Papa from 'papaparse'
import { Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-vue-next'
import Button from './ui/Button.vue'
import Card from './ui/Card.vue'
import Alert from './ui/Alert.vue'
import { ChirpStackClient, type DeviceData } from '@/services/chirpstack'

const csvFile = ref<File | null>(null)
const devices = ref<DeviceData[]>([])
const isProcessing = ref(false)
const uploadStatus = ref<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle')
const errorMessage = ref('')
const successCount = ref(0)
const failedCount = ref(0)
const currentProgress = ref(0)
const totalProgress = ref(0)
const uploadErrors = ref<Array<{ device: DeviceData; error: string }>>([])

// Configuration from environment variables
const chirpstackUrl = import.meta.env.VITE_CHIRPSTACK_URL || ''
const apiToken = import.meta.env.VITE_CHIRPSTACK_API_TOKEN || ''
const applicationId = import.meta.env.VITE_CHIRPSTACK_APPLICATION_ID || ''
const deviceProfileId = import.meta.env.VITE_CHIRPSTACK_DEVICE_PROFILE_ID || ''

const deviceCount = computed(() => devices.value.length)
const isConfigured = computed(() => chirpstackUrl && apiToken && applicationId && deviceProfileId)

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  csvFile.value = file
  uploadStatus.value = 'parsing'
  errorMessage.value = ''
  devices.value = []

  Papa.parse<DeviceData>(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.errors.length > 0) {
        const firstError = results.errors[0]
        errorMessage.value = `CSV parsing error: ${firstError?.message || 'Unknown error'}`
        uploadStatus.value = 'error'
        return
      }

      // Validate headers
      const headers = results.meta.fields || []
      if (!headers.includes('device_name') || !headers.includes('deveui')) {
        errorMessage.value = 'CSV must contain "device_name" and "deveui" headers'
        uploadStatus.value = 'error'
        return
      }

      // Validate data
      const validDevices = results.data.filter(device => {
        return device.device_name && device.deveui
      })

      if (validDevices.length === 0) {
        errorMessage.value = 'No valid devices found in CSV'
        uploadStatus.value = 'error'
        return
      }

      devices.value = validDevices
      uploadStatus.value = 'idle'
    },
    error: (error) => {
      errorMessage.value = `Failed to parse CSV: ${error.message}`
      uploadStatus.value = 'error'
    }
  })
}

const uploadDevices = async () => {
  if (!isConfigured.value) {
    errorMessage.value = 'ChirpStack configuration is missing. Please check your .env file.'
    uploadStatus.value = 'error'
    return
  }

  if (devices.value.length === 0) {
    errorMessage.value = 'No devices to upload'
    return
  }

  isProcessing.value = true
  uploadStatus.value = 'uploading'
  errorMessage.value = ''
  successCount.value = 0
  failedCount.value = 0
  uploadErrors.value = []

  try {
    const client = new ChirpStackClient(chirpstackUrl, apiToken)

    const results = await client.registerDevices(
      applicationId,
      deviceProfileId,
      devices.value,
      (current, total) => {
        currentProgress.value = current
        totalProgress.value = total
      }
    )

    successCount.value = results.success
    failedCount.value = results.failed
    uploadErrors.value = results.errors

    if (results.failed === 0) {
      uploadStatus.value = 'success'
    } else if (results.success === 0) {
      uploadStatus.value = 'error'
      errorMessage.value = 'All devices failed to register'
    } else {
      uploadStatus.value = 'success'
      errorMessage.value = `${results.success} devices registered, ${results.failed} failed`
    }
  } catch (error: any) {
    uploadStatus.value = 'error'
    errorMessage.value = error.message || 'Failed to upload devices'
  } finally {
    isProcessing.value = false
  }
}

const reset = () => {
  csvFile.value = null
  devices.value = []
  uploadStatus.value = 'idle'
  errorMessage.value = ''
  successCount.value = 0
  failedCount.value = 0
  currentProgress.value = 0
  totalProgress.value = 0
  uploadErrors.value = []
}
</script>

<template>
  <div class="min-h-screen bg-background p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <div class="text-center space-y-2">
        <h1 class="text-4xl font-bold text-foreground">ChirpStack Bulk Device Importer</h1>
        <p class="text-muted-foreground">
          Import LoRaWAN devices to your ChirpStack v4 server via CSV file
        </p>
      </div>

      <Alert v-if="!isConfigured" variant="destructive">
        <AlertCircle class="h-4 w-4 inline mr-2" />
        <strong>Configuration Missing:</strong> Please configure VITE_CHIRPSTACK_URL,
        VITE_CHIRPSTACK_API_TOKEN, VITE_CHIRPSTACK_APPLICATION_ID, and
        VITE_CHIRPSTACK_DEVICE_PROFILE_ID in your .env file
      </Alert>

      <Card class="p-6 space-y-4">
        <div class="space-y-2">
          <h2 class="text-2xl font-semibold">CSV Format Requirements</h2>
          <p class="text-muted-foreground">
            Your CSV file must include the following headers:
          </p>
          <div class="bg-muted p-4 rounded-md font-mono text-sm">
            device_name,deveui
          </div>
          <p class="text-sm text-muted-foreground">
            Example:
          </p>
          <div class="bg-muted p-4 rounded-md font-mono text-sm">
            device_name,deveui<br>
            Sensor-01,0102030405060708<br>
            Sensor-02,0102030405060709
          </div>
        </div>

        <div class="space-y-4">
          <div class="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <label class="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                class="hidden"
                @change="handleFileChange"
                :disabled="isProcessing"
              />
              <Button variant="outline" :disabled="isProcessing">
                Select CSV File
              </Button>
            </label>
            <p v-if="csvFile" class="mt-4 text-sm text-muted-foreground">
              Selected: {{ csvFile.name }}
            </p>
          </div>

          <Alert v-if="deviceCount > 0" variant="success">
            <CheckCircle class="h-4 w-4 inline mr-2" />
            Found <strong>{{ deviceCount }}</strong> device(s) in the CSV file
          </Alert>

          <Alert v-if="errorMessage" variant="destructive">
            <XCircle class="h-4 w-4 inline mr-2" />
            {{ errorMessage }}
          </Alert>

          <div v-if="uploadStatus === 'uploading'" class="space-y-2">
            <div class="flex justify-between text-sm">
              <span>Uploading devices...</span>
              <span>{{ currentProgress }} / {{ totalProgress }}</span>
            </div>
            <div class="w-full bg-muted rounded-full h-2">
              <div
                class="bg-primary h-2 rounded-full transition-all"
                :style="{ width: `${(currentProgress / totalProgress) * 100}%` }"
              />
            </div>
          </div>

          <div v-if="uploadStatus === 'success'" class="space-y-2">
            <Alert variant="success">
              <CheckCircle class="h-4 w-4 inline mr-2" />
              Successfully registered {{ successCount }} device(s)
              <span v-if="failedCount > 0">, {{ failedCount }} failed</span>
            </Alert>

            <div v-if="uploadErrors.length > 0" class="mt-4">
              <h3 class="font-semibold mb-2">Errors:</h3>
              <div class="space-y-1 max-h-60 overflow-y-auto">
                <div
                  v-for="(error, index) in uploadErrors"
                  :key="index"
                  class="text-sm bg-destructive/10 p-2 rounded"
                >
                  <strong>{{ error.device.device_name }}</strong> ({{ error.device.deveui }}): {{ error.error }}
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-4">
            <Button
              @click="uploadDevices"
              :disabled="deviceCount === 0 || isProcessing || !isConfigured"
              class="flex-1"
            >
              {{ isProcessing ? 'Uploading...' : 'Upload to ChirpStack' }}
            </Button>
            <Button
              @click="reset"
              variant="outline"
              :disabled="isProcessing"
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
