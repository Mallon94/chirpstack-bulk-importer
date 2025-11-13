<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-xl border p-4 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground border-border',
        destructive:
          'bg-red-50 border-red-200 text-red-800 [&>svg]:text-red-600',
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800 [&>svg]:text-emerald-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface AlertProps {
  variant?: VariantProps<typeof alertVariants>['variant']
  class?: string
}

const props = withDefaults(defineProps<AlertProps>(), {
  variant: 'default',
})

const alertClass = computed(() =>
  cn(alertVariants({ variant: props.variant }), props.class)
)
</script>

<template>
  <div :class="alertClass">
    <slot />
  </div>
</template>
