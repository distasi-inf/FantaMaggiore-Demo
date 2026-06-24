import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router,RouterLink } from '@angular/router';
import { toast } from 'ngx-sonner';
import { FantaToastComponent } from '../../../shared/components/fanta-toast/fanta-toast.component';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.scss',
})
export class Register implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  private destroy$ = new Subject<void>();

  usernameInput$ = new Subject<string>();
  emailInput$ = new Subject<string>();
  teamNameInput$ = new Subject<string>();

  emailOk = false;
  teamNameOk = false;
  usernameOk = false;
  isSubmitting = false;

  hidePassword = true; // Gestisce la visibilità della password principale
  hideConfirmPassword = true; // Gestisce la visibilità della password di conferma

  countries = [
    { code: 'it', name: 'Italia' },
    { code: 'ar', name: 'Argentina' },
    { code: 'br', name: 'Brasile' },
    { code: 'fr', name: 'Francia' },
    { code: 'de', name: 'Germania' },
    { code: 'es', name: 'Spagna' },
    { code: 'gb-eng', name: 'Inghilterra' },
    { code: 'pt', name: 'Portogallo' },
    { code: 'nl', name: 'Olanda' },
    { code: 'be', name: 'Belgio' },
    { code: 'hr', name: 'Croazia' },
    { code: 'uy', name: 'Uruguay' },
    { code: 'co', name: 'Colombia' },
    { code: 'sn', name: 'Senegal' },
    { code: 'ma', name: 'Marocco' },
    { code: 'us', name: 'Stati Uniti' },
    { code: 'jp', name: 'Giappone' },
    { code: 'kr', name: 'Corea del Sud' },
  ];

  passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    return password && confirmPassword && password.value === confirmPassword.value
      ? null
      : { passwordMismatch: true };
  };

  registerForm: FormGroup = this.fb.group(
    {
      // Aggiunto l'apostrofo \' alla Regex
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÀ-ÿ' ]*$/)]],
      surname: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÀ-ÿ' ]*$/)]],

      // Username e Team Name rimangono alfanumerici (senza apostrofo solitamente)
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9 ]*$/)]],
      nationality: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[A-Z])(?=.*[0-9]).{8,}$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
      fantasyTeamName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9 ]*$/)]],
    },
    { validators: this.passwordMatchValidator },
  );

  ngOnInit() {
    this.setupInputListeners();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupInputListeners() {
    this.usernameInput$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((value) =>
          value.length >= 3 ? this.authService.checkUsername(value) : of(true),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((isAvailable) => {
        this.usernameOk = isAvailable;
        this.updateControlValidity('username', isAvailable, 'nameTaken');
      });

    this.emailInput$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((value) =>
          value.includes('@') && value.length > 5 ? this.authService.checkEmail(value) : of(true),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((isAvailable) => {
        this.emailOk = isAvailable;
        this.updateControlValidity('email', isAvailable, 'emailTaken');
      });

    this.teamNameInput$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((value) =>
          value.length >= 3 ? this.authService.checkTeamName(value) : of(true),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((isAvailable) => {
        this.teamNameOk = isAvailable;
        this.updateControlValidity('fantasyTeamName', isAvailable, 'nameTaken');
      });
  }

  private updateControlValidity(controlName: string, isAvailable: boolean, errorKey: string) {
    const ctrl = this.registerForm.get(controlName);
    const currentErrors = ctrl?.errors || {};
    if (!isAvailable) {
      ctrl?.setErrors({ ...currentErrors, [errorKey]: true });
    } else {
      delete currentErrors[errorKey];
      ctrl?.setErrors(Object.keys(currentErrors).length ? currentErrors : null);
    }
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isSubmitting = true;
      const rawData = this.registerForm.value;
      const payload = {
        name: rawData.firstName,
        surname: rawData.surname,
        username: rawData.username,
        nationality: rawData.nationality,
        email: rawData.email,
        password: rawData.password,
        fantasyTeamName: rawData.fantasyTeamName,
      };

      this.authService.register(payload).subscribe({
        next: () => {
          toast.custom(FantaToastComponent, {
            componentProps: {
              title: 'Benvenuto!',
              message: 'Registrazione completata.',
              iconName: 'user-check',
              isSuccess: true,
            },
          });
          setTimeout(() => this.router.navigate(['/login']), 1500);
        },
        error: (err) => {
          this.isSubmitting = false;
          toast.error('Errore durante la registrazione. Riprova.');
        },
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }

  togglePassword() {
    this.hidePassword = !this.hidePassword;
  }

  toggleConfirmPassword() {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }

  // Recupera l'oggetto della nazione attualmente selezionata
  getSelectedCountry() {
    const code = this.registerForm.get('nationality')?.value;
    return this.countries.find((c) => c.code === code);
  }

  // Imposta il valore nel form e chiude la tendina
  setNationality(code: string) {
    this.registerForm.get('nationality')?.setValue(code);
    this.registerForm.get('nationality')?.markAsTouched();

    // Rimuove il focus per chiudere il menu a tendina di DaisyUI
    (document.activeElement as HTMLElement)?.blur();
  }
}
