import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, MessageCircle, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="mx-auto max-w-lg px-4 py-6 text-center text-sm text-muted-foreground">
      <div className="flex items-center justify-center gap-4 mb-3">
        <a href="https://www.facebook.com/champschickenSA/" target="_blank" rel="noreferrer" aria-label="Champs Facebook" className="inline-flex items-center gap-2 text-muted-foreground hover:text-brand">
          <Facebook className="h-5 w-5" /> Facebook
        </a>
        <a href="https://www.instagram.com/champschickensa/?hl=en" target="_blank" rel="noreferrer" aria-label="Champs Instagram" className="inline-flex items-center gap-2 text-muted-foreground hover:text-brand">
          <Instagram className="h-5 w-5" /> Instagram
        </a>
        <a href="#" aria-label="WhatsApp placeholder" className="inline-flex items-center gap-2 text-muted-foreground hover:text-brand">
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
        <a href="mailto:champsalice@gmail.com" aria-label="Email" className="inline-flex items-center gap-2 text-muted-foreground hover:text-brand">
          <Mail className="h-5 w-5" /> Email
        </a>
      </div>
      <div className="mb-2">
        <Link to="/privacy" className="text-xs text-muted-foreground underline">Privacy Policy</Link>
      </div>
      <div className="text-[12px] text-muted-foreground">&copy; Champs Chicken. All rights reserved.</div>
    </footer>
  );
}
