import React from 'react';
import { Link } from 'react-router-dom';

// Sourced verbatim from "Casa Yun - Showroom Visit Terms and Conditions.docx".
// Update that document first, then mirror any changes here.
interface Clause {
  text: string;
  bullets?: string[];
}

interface Section {
  title: string;
  clauses: Clause[];
}

const SECTIONS: Section[] = [
  {
    title: '1. Nature of the Showroom',
    clauses: [
      {
        text: '1.1 The Showroom operates on a 24-hour, unattended, self-guided basis. No staff member is physically present on-site at any time.',
      },
      {
        text: '1.2 Access is granted solely for the purpose of viewing furniture and interior design displays. The Showroom is not staffed for on-site sales, cash handling, or in-person transactions.',
      },
      {
        text: '1.3 Yun Shang Pte Ltd reserves the right to refuse, suspend, or revoke access to any Visitor at its discretion, including for breach of these Terms.',
      },
    ],
  },
  {
    title: '2. Booking and Access',
    clauses: [
      {
        text: "2.1 Visitors must book an appointment via the Casa Yun website prior to visiting. A one-time PIN code / smart lock access code will be issued to the Visitor's registered mobile number and/or email closer to the appointment time.",
      },
      {
        text: '2.2 The access code is personal to the Visitor and the booked time slot. It must not be shared with, sold to, or used by any person other than the Visitor and their declared guests.',
      },
      {
        text: '2.3 Visitors must arrive and depart within their booked time slot. Access outside the confirmed slot is not permitted and may be treated as unauthorised entry.',
      },
      {
        text: '2.4 Each visit is typically allocated up to 2 hours. If a Visitor anticipates requiring a longer period, they must contact Casa Yun in advance to request an extended slot. Access is not guaranteed beyond the booked duration without prior arrangement.',
      },
      {
        text: '2.5 Overnight stays are strictly not permitted under any circumstances. Visitors must vacate the Showroom by the end of their booked time slot and in any event must not remain on the premises overnight.',
      },
      {
        text: '2.6 Visitors are responsible for ensuring the entrance door is securely closed and locked upon exit. Failure to do so may result in the Visitor being held liable for any resulting loss, theft, or damage.',
      },
      {
        text: '2.7 In the event the smart lock malfunctions or the access code fails, Visitors should contact the support channels stated in Clause 8 and should not attempt to force entry.',
      },
    ],
  },
  {
    title: '3. Conduct Inside the Showroom',
    clauses: [
      {
        text: '3.1 Visitors agree to:',
        bullets: [
          'Handle all furniture, fixtures, and displayed items with reasonable care;',
          'Refrain from climbing, standing, jumping, or lying on display furniture beyond its normal intended use (e.g. sitting on a sofa, lying briefly on a display bed is permitted; standing on furniture is not);',
          'Refrain from dismantling, forcibly testing, or tampering with any mechanical or electrically adjustable components beyond normal demonstration use;',
          'Not remove, relocate, or take away any showroom item, signage, fixture, or accessory;',
          'Not smoke, vape, consume food or beverages (other than water), or bring in open flames within the Showroom;',
          'Not bring in pets;',
          'Comply with all posted signage and safety instructions within the premises.',
        ],
      },
      {
        text: "3.2 The Showroom is monitored by live and recorded CCTV for security purposes. By entering, Visitors consent to being recorded. See Clause 7 (Data Protection) for details.",
      },
      {
        text: "3.3 Yun Shang Pte Ltd reserves the right to remotely intervene (e.g. via two-way audio, if installed, or by directing security/authorities) if a Visitor's conduct raises safety or security concerns.",
      },
    ],
  },
  {
    title: '4. Children and Accompanied Persons',
    clauses: [
      {
        text: "4.1 Children are welcome but must be accompanied and supervised by a responsible adult at all times while inside the Showroom. The accompanying adult is fully responsible for the child's safety and conduct.",
      },
      { text: '4.2 Children must not be left unattended in the Showroom at any point.' },
      {
        text: '4.3 The adult Visitor who made the booking is responsible for the conduct of all guests, including children, brought under their booking.',
      },
    ],
  },
  {
    title: '5. Liability and Assumption of Risk',
    clauses: [
      {
        text: '5.1 General. Visitors enter and use the Showroom entirely at their own risk. As the Showroom is unattended, Visitors must exercise their own judgment regarding their safety and the safety of those accompanying them.',
      },
      {
        text: '5.2 Personal injury. To the maximum extent permitted by law, Yun Shang Pte Ltd, its directors, employees, and agents shall not be liable for any personal injury, illness, or death arising from a Visitor’s use of the Showroom, except to the extent such injury, illness, or death is caused by the proven negligence or wilful default of Yun Shang Pte Ltd. Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited under Singapore law.',
      },
      {
        text: '5.3 Damage to property. Visitors shall be liable for any loss or damage caused to furniture, fixtures, fittings, or property within the Showroom arising from their own negligence, misuse, or that of their accompanying guests (including children). Yun Shang Pte Ltd reserves the right to recover reasonable repair or replacement costs from the responsible Visitor.',
      },
      {
        text: "5.4 Visitor's own belongings. Yun Shang Pte Ltd does not provide storage or supervision of personal belongings. Visitors are responsible for their own belongings brought into the Showroom and should not leave valuables unattended.",
      },
      {
        text: '5.5 Force majeure. Yun Shang Pte Ltd shall not be liable for any failure or delay in providing access, or for any loss arising from circumstances beyond its reasonable control, including power outages, internet/network failure affecting smart lock access, or acts of God.',
      },
    ],
  },
  {
    title: '6. Emergency Procedures',
    clauses: [
      {
        text: '6.1 As the Showroom is unattended, in the event of a fire, medical emergency, or immediate danger to life, Visitors must first call 995 (SCDF/Ambulance) or 999 (Police) as appropriate, then notify Casa Yun using the support contact details published on the Casa Yun website main page.',
      },
      {
        text: '6.2 In the event of a non-life-threatening issue (e.g. lock malfunction, unable to exit, suspicious activity), Visitors should contact Casa Yun using the support contact details published on the Casa Yun website main page.',
      },
      {
        text: '6.3 Fire exits, extinguishers, and evacuation routes are marked within the Showroom. Visitors should familiarise themselves with the nearest exit upon entry.',
      },
      {
        text: '6.4 Visitors must comply with any instructions issued remotely by Casa Yun staff monitoring the live CCTV feed during an emergency.',
      },
    ],
  },
  {
    title: '7. Data Protection (PDPA)',
    clauses: [
      {
        text: '7.1 By booking an appointment, Visitors consent to Yun Shang Pte Ltd collecting, using, and disclosing their personal data (including name, contact number, email, and NRIC/passport details if collected) for the purposes of:',
        bullets: [
          'Verifying identity and managing showroom bookings and access;',
          'Issuing access codes and appointment reminders;',
          'Security monitoring and incident investigation via CCTV;',
          'Following up on enquiries or orders placed via the Casa Yun website.',
        ],
      },
      {
        text: '7.2 CCTV footage is retained for a limited period for security purposes and may be reviewed in the event of an incident, dispute, or suspected breach of these Terms.',
      },
      {
        text: '7.3 Misbehaviour and misconduct. Where a Visitor engages in misbehaviour, misconduct, damage, theft, or any breach of these Terms, Yun Shang Pte Ltd reserves the right, at its sole discretion, to share the relevant CCTV footage with the Singapore Police Force or other relevant authorities, and/or to publish or share such footage on social media or other public platforms, for the purposes of reporting, deterrence, and public awareness. By entering the Showroom, Visitors acknowledge and accept this.',
      },
      {
        text: '7.4 Marketing use. By entering the Showroom, Visitors also consent to Yun Shang Pte Ltd using CCTV footage (which may capture their likeness) for general marketing, promotional, and social media purposes (e.g. showcasing the showroom experience). Visitors who do not wish to be featured in marketing materials should inform Casa Yun in advance via the contact details on the Casa Yun website main page, and reasonable efforts will be made to accommodate such requests, though this cannot be guaranteed given the unattended nature of the Showroom.',
      },
      {
        text: "7.5 This consent is given in accordance with the Personal Data Protection Act 2012 (Singapore). Visitors may withdraw consent (including specifically for marketing use under Clause 7.4) or request access/correction of their personal data by contacting Yun Shang Pte Ltd using the contact details published on the Casa Yun website main page, subject to legal and contractual restrictions. Withdrawal of consent for marketing use does not affect Yun Shang Pte Ltd's rights under Clause 7.3.",
      },
      {
        text: '7.6 Personal data will not be shared with third parties except as necessary for the purposes above, or as required by law.',
      },
    ],
  },
  {
    title: '8. Support and Contact',
    clauses: [
      {
        text: '8.1 For all enquiries, support requests (including requests for an extended visit duration), and emergency non-life-threatening assistance, please refer to the contact phone number and email address published on the Casa Yun website main page.',
      },
    ],
  },
  {
    title: '9. General',
    clauses: [
      {
        text: "9.1 Yun Shang Pte Ltd reserves the right to amend these Terms & Conditions at any time. The version in effect at the time of the Visitor's booking shall apply.",
      },
      {
        text: '9.2 If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.',
      },
      {
        text: '9.3 These Terms are governed by and construed in accordance with the laws of Singapore, and the parties submit to the exclusive jurisdiction of the Singapore courts.',
      },
      {
        text: '9.4 By clicking "I Agree" during the booking process, the Visitor confirms that they have read, understood, and accepted these Terms & Conditions on behalf of themselves and any guests accompanying them.',
      },
    ],
  },
];

const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Showroom Visit — Terms &amp; Conditions</h1>
      <p className="text-sm text-gray-500">Operated by Yun Shang Pte Ltd</p>
      <p className="text-sm text-gray-500 mb-10">Last updated: August 2026</p>

      <p className="text-gray-700 leading-relaxed mb-10">
        By booking an appointment and/or entering the Casa Yun showroom (&ldquo;Showroom&rdquo;), you
        (&ldquo;Visitor&rdquo;) agree to be bound by the following Terms &amp; Conditions. Please read them
        carefully before confirming your booking. If you do not agree, please do not proceed with the
        booking or enter the Showroom.
      </p>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{section.title}</h2>
            <div className="space-y-3">
              {section.clauses.map((clause) => (
                <div key={clause.text}>
                  <p>{clause.text}</p>
                  {clause.bullets && (
                    <ul className="list-disc pl-6 mt-2 space-y-1">
                      {clause.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="text-gray-700 leading-relaxed mt-10">
        Questions about these terms? Reach us via the{' '}
        <Link to="/visit-us" className="text-terracotta-600 hover:text-terracotta-700 font-medium">
          contact page
        </Link>
        .
      </p>
    </div>
  );
};

export default TermsPage;
