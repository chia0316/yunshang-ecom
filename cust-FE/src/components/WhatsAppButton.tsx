import React from 'react';

const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER || '').trim();
const WHATSAPP_DEFAULT_MESSAGE = "Hi, I'd like to enquire about your products.";

const WhatsAppButton: React.FC = () => {
  if (!WHATSAPP_NUMBER) return null;

  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8" fill="currentColor" aria-hidden="true">
        <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.362.688 4.564 1.875 6.418L4 29l7.79-1.837A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.75a9.7 9.7 0 0 1-4.95-1.354l-.355-.21-4.622 1.09 1.117-4.5-.232-.368A9.71 9.71 0 0 1 5.25 15c0-5.936 4.818-10.75 10.754-10.75S26.75 9.064 26.75 15 21.94 24.75 16.004 24.75Zm5.593-7.32c-.306-.153-1.81-.893-2.09-.995-.28-.102-.484-.153-.688.153-.204.306-.79.995-.968 1.2-.178.204-.357.23-.663.077-.306-.153-1.292-.476-2.463-1.52-.91-.812-1.524-1.814-1.703-2.12-.178-.306-.019-.472.134-.624.138-.137.306-.357.459-.535.153-.178.204-.306.306-.51.102-.204.051-.383-.026-.536-.077-.153-.688-1.658-.943-2.27-.248-.596-.5-.516-.688-.526l-.586-.01c-.204 0-.535.077-.815.383-.28.306-1.07 1.045-1.07 2.55s1.096 2.958 1.249 3.163c.153.204 2.157 3.293 5.226 4.618.73.315 1.3.503 1.744.644.733.233 1.4.2 1.927.121.588-.088 1.81-.74 2.065-1.454.255-.714.255-1.326.178-1.454-.076-.128-.28-.204-.586-.357Z" />
      </svg>
    </a>
  );
};

export default WhatsAppButton;
