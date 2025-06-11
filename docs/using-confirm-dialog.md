# Using the Confirm Dialog in Unfit for Print

This guide explains how to use the confirmation dialog component in your application to prompt users for confirmation before performing actions.

## Overview

The confirm dialog is a reusable component that displays a modal dialog with a message and two buttons: a cancel button and a confirm button. It's useful for confirming destructive actions like deleting items or for any action that requires user confirmation.

## How to Use

### 1. Import the useConfirm Composable

First, import the `useConfirm` composable in your component:

```vue
<script setup lang="ts">
import useConfirm from '~/composables/useConfirm';
</script>
```

### 2. Call the useConfirm Function

The `useConfirm` function returns a promise that resolves to `true` if the user confirms the action, or `false` if they cancel. You can use it in an async function:

```vue
<script setup lang="ts">
import useConfirm from '~/composables/useConfirm';

async function deleteItem(id: string) {
  // Show confirmation dialog
  const confirmed = await useConfirm({
    title: 'Delete Item',
    message: 'Are you sure you want to delete this item? This action cannot be undone.',
    buttonText: 'Delete',
    buttonColor: 'red',
    cancelButtonText: 'Cancel'
  });

  // If user confirmed, proceed with the action
  if (confirmed) {
    // Perform the delete action
    console.log('Deleting item:', id);
  }
}
</script>
```

### 3. Available Options

The `useConfirm` function accepts an options object with the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | 'Confirm' | The title of the confirmation dialog |
| `message` | string | 'Are you sure you want to proceed?' | The message displayed in the dialog |
| `buttonText` | string | 'Confirm' | The text for the confirm button |
| `buttonColor` | string | 'primary' | The color of the confirm button (e.g., 'red', 'blue', 'green') |
| `cancelButtonText` | string | 'Cancel' | The text for the cancel button |

## Example: Confirming a Delete Action

Here's a complete example of using the confirm dialog to confirm a delete action:

```vue
<template>
  <div>
    <UButton 
      color="red" 
      variant="ghost" 
      icon="i-heroicons-trash" 
      @click="deleteItem(item.id)"
    />
  </div>
</template>

<script setup lang="ts">
import useConfirm from '~/composables/useConfirm';

const props = defineProps<{
  item: { id: string; name: string }
}>();

const emit = defineEmits(['delete']);

async function deleteItem(id: string) {
  const confirmed = await useConfirm({
    title: 'Delete Item',
    message: `Are you sure you want to delete "${props.item.name}"? This action cannot be undone.`,
    buttonText: 'Delete',
    buttonColor: 'red',
    cancelButtonText: 'Cancel'
  });

  if (confirmed) {
    emit('delete', id);
  }
}
</script>
```

## How It Works

The confirm dialog uses a singleton pattern to ensure that only one dialog is shown at a time. When you call `useConfirm()`, it:

1. Sets up the dialog options
2. Opens the dialog
3. Returns a promise that resolves when the user clicks either the confirm or cancel button
4. The dialog is automatically closed after the user makes a choice

The dialog is implemented as a separate Vue app instance that's mounted to the DOM when the application starts, ensuring it's always available when needed.