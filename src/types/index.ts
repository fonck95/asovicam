export interface CropInfo {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  benefits: string[];
  icon: string;
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface Testimonial {
  id: string;
  author: string;
  role: string;
  content: string;
}

export interface NavLink {
  label: string;
  path: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}
