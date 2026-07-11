import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ContactFormData } from '../types';
import { API_BASE_URL, sendContactMessage } from '../lib/api';
import type { ContactFieldErrors } from '../lib/api';

const CONTACT_EMAIL = 'asovicam2023@gmail.com';

const subjectLabels: Record<string, string> = {
  info: 'Información general',
  visita: 'Visitar los cultivos',
  alianza: 'Alianza o colaboración',
  compra: 'Compra de productos',
  asociarse: 'Asociarse a ASOVICAM',
  otro: 'Otro',
};

const initialState: ContactFormData = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

export type ContactStatus = 'idle' | 'sending' | 'success' | 'error';

export function useContactForm() {
  const [formData, setFormData] = useState<ContactFormData>(initialState);
  const [status, setStatus] = useState<ContactStatus>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  // 429 del backend (5 envíos / 15 min por IP): se bloquea el botón hasta
  // recargar la página, no tiene sentido reintentar de inmediato.
  const [rateLimited, setRateLimited] = useState(false);
  // true cuando el mensaje salió por el cliente de correo del visitante
  // (solo pasa en builds sin VITE_API_BASE_URL configurada).
  const [sentViaMailto, setSentViaMailto] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const field = e.target.name;
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // El error de un campo desaparece en cuanto el usuario lo corrige.
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const subject = subjectLabels[formData.subject] ?? formData.subject;

    // Respaldo sin backend configurado: abre el cliente de correo del
    // visitante con el mensaje redactado hacia el buzón de la asociación.
    if (!API_BASE_URL) {
      const body = [`Nombre: ${formData.name}`, `Correo: ${formData.email}`, '', formData.message].join('\n');
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[Web ASOVICAM] ${subject}`)}&body=${encodeURIComponent(body)}`;
      setSentViaMailto(true);
      setStatus('success');
      return;
    }

    setStatus('sending');
    setFormError(null);
    setFieldErrors({});

    const result = await sendContactMessage({
      name: formData.name.trim(),
      email: formData.email.trim(),
      subject,
      message: formData.message.trim(),
    });

    if (result.ok) {
      setStatus('success');
      return;
    }

    setStatus('error');
    setFormError(result.error);
    if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    if (result.status === 429) setRateLimited(true);
  };

  const reset = () => {
    setFormData(initialState);
    setStatus('idle');
    setFormError(null);
    setFieldErrors({});
    setSentViaMailto(false);
  };

  return {
    formData,
    status,
    formError,
    fieldErrors,
    rateLimited,
    sentViaMailto,
    handleChange,
    handleSubmit,
    reset,
  };
}
