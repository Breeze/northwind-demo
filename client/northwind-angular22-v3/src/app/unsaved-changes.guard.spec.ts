import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Confirmation, ConfirmationService } from '@openng/optimus-ui/api';
import { ConfirmDialogModule } from '@openng/optimus-ui/confirmdialog';

import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  let confirmationService: ConfirmationService;
  let confirmation: Confirmation | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ConfirmationService] });
    confirmationService = TestBed.inject(ConfirmationService);
    confirmation = undefined;
    // Capture the confirmation instead of showing a dialog
    vi.spyOn(confirmationService, 'confirm').mockImplementation(c => {
      confirmation = c;
      return confirmationService;
    });
  });

  function runGuard(hasChanges: boolean) {
    const component: HasUnsavedChanges = { hasUnsavedChanges: () => hasChanges };
    return TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot));
  }

  it('should allow navigation when there are no changes', () => {
    expect(runGuard(false)).toBe(true);
    expect(confirmationService.confirm).not.toHaveBeenCalled();
  });

  it('should allow navigation when the user discards the changes', async () => {
    const result = runGuard(true);
    expect(confirmation?.header).toBe('Unsaved Changes');
    confirmation!.accept!();
    await expect(result).resolves.toBe(true);
  });

  it('should cancel navigation when the user cancels or closes the dialog', async () => {
    const result = runGuard(true);
    confirmation!.reject!();
    await expect(result).resolves.toBe(false);
  });
});

@Component({
  imports: [ConfirmDialogModule],
  template: '<p-confirmdialog />',
})
class DialogHost {}

describe('unsavedChangesGuard with the confirm dialog', () => {
  let fixture: ComponentFixture<DialogHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogHost],
      providers: [ConfirmationService],
    }).compileComponents();
    fixture = TestBed.createComponent(DialogHost);
    await fixture.whenStable();
  });

  async function openDialog() {
    const component: HasUnsavedChanges = { hasUnsavedChanges: () => true };
    const result = TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot));
    await fixture.whenStable();
    return { result };
  }

  // The dialog is appended to the document body, not the host element
  function button(label: string) {
    return [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label) as HTMLButtonElement;
  }

  it('should show the dialog, and discard on "Discard Changes"', async () => {
    const { result } = await openDialog();
    expect(document.body.textContent).toContain('You have changes that have not been saved.');
    button('Discard Changes').click();
    await expect(result).resolves.toBe(true);
  });

  it('should stay on "Cancel"', async () => {
    const { result } = await openDialog();
    button('Cancel').click();
    await expect(result).resolves.toBe(false);
  });
});
