import React from 'react';

// Placeholder terms — covers the showroom-appointment flow specifically
// since that's the first place on the site that requires agreement before
// submitting. Have an actual lawyer review/replace this before relying on
// it for anything beyond the appointment-booking clause.
const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: 12 August 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Showroom Appointments</h2>
          <p>
            By submitting a showroom appointment request, you agree to the following:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              Appointment times are requests, not confirmed bookings, until our team
              confirms the date and time with you directly (via phone, email, or WhatsApp).
            </li>
            <li>
              Please arrive within 15 minutes of your confirmed slot. Repeated no-shows may
              affect our ability to offer future appointments.
            </li>
            <li>
              If you need to reschedule or cancel, please let us know as early as possible
              so the slot can be offered to another customer.
            </li>
            <li>
              Choosing an appointment "without a sales person" means you&apos;ll browse the
              showroom independently; a team member remains available on-site if you have
              questions.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">General</h2>
          <p>
            These terms apply to your use of the Casa Yun website and showroom services.
            We may update these terms from time to time; continued use of our services
            after changes means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact</h2>
          <p>
            Questions about these terms? Reach us via the{' '}
            <a href="/visit-us" className="text-terracotta-600 hover:text-terracotta-700 font-medium">
              contact page
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
