import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmationService } from '@openng/optimus-ui/api';

/** A routed component whose EntityManager may hold changes that have not been saved. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Before leaving a route, ask the user whether to discard unsaved changes.
 * Discarding lets the navigation proceed; the component's EntityManager, and its
 * changes, go away with the component.  Cancelling (or closing the dialog) stays put.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  const confirmationService = inject(ConfirmationService);
  return new Promise<boolean>(resolve => {
    confirmationService.confirm({
      header: 'Unsaved Changes',
      message: 'You have changes that have not been saved. Do you want to discard them?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Discard Changes', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => resolve(true),
      reject: () => resolve(false),
    });
  });
};
