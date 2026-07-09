import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ContactFormData } from '../types';

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

export function useContactForm() {
  const [formData, setFormData] = useState<ContactFormData>(initialState);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Sin backend disponible: abre el cliente de correo del visitante con el
  // mensaje ya redactado hacia el buzón de la asociación.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = `[Web ASOVICAM] ${subjectLabels[formData.subject] ?? formData.subject}`;
    const body = [
      `Nombre: ${formData.name}`,
      `Correo: ${formData.email}`,
      '',
      formData.message,
    ].join('\n');
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  const reset = () => {
    setFormData(initialState);
    setSubmitted(false);
  };

  return { formData, submitted, handleChange, handleSubmit, reset };
}
