<script setup lang="ts">
import { cn } from '@/lib/utils'

interface CardProps {
  class?: string
}

const props = withDefaults(defineProps<CardProps>(), {})
</script>

<template>
  <div :class="cn('rounded-2xl border bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300', props.class)">
    <slot />
  </div>
</template>
