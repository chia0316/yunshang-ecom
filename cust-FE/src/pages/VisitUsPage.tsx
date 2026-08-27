import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MapPin, Phone, Mail as MailIcon } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';

type EnquiryType = 'appointment' | 'enquiry' | 'other';

const TYPE_OPTIONS: { value: EnquiryType; label: string }[] = [
  { value: 'appointment', label: 'Book a Showroom Appointment' },
  { value: 'enquiry', label: 'General Enquiry' },
  { value: 'other', label: 'Other' },
];

// Rolling 2-week booking window, recomputed on every render so it's always
// "today" through "today + 14 days" — never a stale hardcoded date.
const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const getAppointmentDateBounds = () => {
  const today = new Date();
  const max = new Date(today);
  max.setDate(max.getDate() + 14);
  return { min: toDateInputValue(today), max: toDateInputValue(max) };
};

// Store is open 24 hours, so every hour of the day is a bookable slot.
const formatHour = (hour: number) => {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
};
const TIME_SLOT_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const start = formatHour(hour);
  const end = formatHour((hour + 1) % 24);
  return `${start} - ${end}`;
});

const VisitUsPage: React.FC = () => {
  const [formData, setFormData] = useState({
    type: 'appointment' as EnquiryType,
    name: '',
    email: '',
    mobile: '',
    preferred_date: '',
    preferred_time: '',
    requires_sales_person: false,
    message: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Which preferred_time slots are already booked, keyed by date — fetched
  // for the whole booking window once so switching the date dropdown
  // doesn't need a round trip. Bumped (via availabilityRefreshKey) after a
  // booking attempt loses a race on a slot (409), so the one that was just
  // taken immediately shows as struck through instead of staying pickable.
  const [takenByDate, setTakenByDate] = useState<Record<string, string[]>>({});
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const appointmentDateBounds = getAppointmentDateBounds();

  useEffect(() => {
    if (formData.type !== 'appointment') return;
    apiFetch<Record<string, string[]>>(
      `/api/enquiries/appointment-availability?from=${appointmentDateBounds.min}&to=${appointmentDateBounds.max}`,
      { auth: false }
    )
      .then(setTakenByDate)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.type, availabilityRefreshKey]);

  const takenTimes = new Set(takenByDate[formData.preferred_date] || []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/enquiries', {
        auth: false,
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          preferred_date: formData.preferred_date || null,
          preferred_time: formData.preferred_time || null,
          mobile: formData.mobile || null,
          message: formData.message || null,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit, please try again');
      if (err instanceof ApiError && err.status === 409) {
        setFormData((prev) => ({ ...prev, preferred_time: '' }));
        setAvailabilityRefreshKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Request Received!</h1>
        <p className="text-gray-600 mb-8">
          Thanks for reaching out. Our team will get back to you shortly.
        </p>
        <Link
          to="/"
          className="inline-block bg-stone-900 text-white py-3 px-6 rounded-lg hover:bg-stone-800 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Visit Our 24 Hours Unattended Smart Furniture Store</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Book a showroom appointment, ask a question, or let us know how we can help —
          we'll get back to you shortly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What can we help with? *</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile *</label>
                <input
                  type="tel"
                  name="mobile"
                  required
                  value={formData.mobile}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>

              {formData.type === 'appointment' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Date</label>
                    <input
                      type="date"
                      name="preferred_date"
                      min={appointmentDateBounds.min}
                      max={appointmentDateBounds.max}
                      value={formData.preferred_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, preferred_date: e.target.value, preferred_time: '' }))
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Appointments can be booked up to 2 weeks in advance.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Time</label>
                    <select
                      name="preferred_time"
                      value={formData.preferred_time}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    >
                      <option value="">Select a time</option>
                      {TIME_SLOT_OPTIONS.map((slot) => {
                        const isTaken = takenTimes.has(slot);
                        return (
                          <option
                            key={slot}
                            value={slot}
                            disabled={isTaken}
                            style={isTaken ? { textDecoration: 'line-through', color: '#9ca3af' } : undefined}
                          >
                            {slot}
                            {isTaken ? ' (Full)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={formData.requires_sales_person}
                        onChange={(e) =>
                          setFormData({ ...formData, requires_sales_person: e.target.checked })
                        }
                        className="rounded border-gray-300 text-terracotta-600 focus:ring-terracotta-500"
                      />
                      Require a sales person (subject to availability)
                    </label>
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                required
                className="mt-0.5 rounded border-gray-300 text-terracotta-600 focus:ring-terracotta-500"
              />
              <span>
                I agree to the{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  className="text-terracotta-600 hover:text-terracotta-700 font-medium"
                >
                  Terms &amp; Conditions
                </Link>
                . Submitting this form means you accept them.
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !agreedToTerms}
              className="w-full bg-stone-900 text-white py-3 px-6 rounded-lg hover:bg-stone-800 transition-colors font-semibold disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 h-fit space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Showroom</h2>
          <div className="flex items-start space-x-3">
            <MapPin className="w-5 h-5 text-terracotta-600 flex-shrink-0 mt-0.5" />
            <a
              href="https://maps.app.goo.gl/CSAgXMJcTDLQdnYd8?g_st=iw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-terracotta-600 transition-colors text-sm"
            >
              73 Ubi Rd 1, #09-64 Oxley Bizhub 1, Singapore 408733
            </a>
          </div>
          <div className="flex items-start space-x-3">
            <Phone className="w-5 h-5 text-terracotta-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 text-sm">+65 8983 5830</span>
          </div>
          <div className="flex items-start space-x-3">
            <MailIcon className="w-5 h-5 text-terracotta-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 text-sm">admin@yunshang.com.sg</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitUsPage;
