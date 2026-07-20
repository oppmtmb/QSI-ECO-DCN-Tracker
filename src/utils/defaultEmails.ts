export interface RawEmailInput {
  id: string;
  subject: string;
  body: string;
}

export const DEFAULT_RAW_EMAILS: RawEmailInput[] = [
  {
    id: 'email_01',
    subject: 'ECO-90210: Update copper plating thickness on PCB-402',
    body: `Hi QSI Team,

Please review and execute the attached Engineering Change Order ECO-90210 for the high-power PCB-402 revision. 
We need to increase the copper plating thickness from 1oz to 2oz on all outer layers to handle higher current loads without overheating.

Please advise on our estimated delivery schedule.

Best regards,
Sarah Jenkins
Lead Hardware Engineer
Apex Circuits Ltd.`
  },
  {
    id: 'email_02',
    subject: '(QSI) RE: ECO-90210: Update copper plating thickness on PCB-402',
    body: `Hello Sarah,

We have received ECO-90210 and checked our inventory. We have sufficient 2oz laminate in stock to handle this batch immediately.
I have initiated our internal document change process. This update will be tracked under QSI Document Change Number DCN-77401.

Our tooling department is modifying the wet line etching times. We will dispatch the updated golden sample by Friday.

Best regards,
Robert Chen
Quality Assurance & Document Control
QSI Manufacturing`
  },
  {
    id: 'email_03',
    subject: 'ECO-88102 - Modification to chassis bracket mounting hole diameter',
    body: `Hi Team at QSI,

We are submitting ECO-88102 to increase the mounting hole diameter on the main aluminum chassis bracket from 4.5mm to 5.2mm.
This is to support standard M5 screws instead of the M4 screws, which were shearing under structural test loads.

This affects the current batch waiting for fabrication. Please let us know if there are any tooling fee adjustments.

Sincerely,
Dave Miller
Lead Mechanical Engineer
TechCorp Manufacturing Systems`
  },
  {
    id: 'email_04',
    subject: '(QSI) RE: Modification to chassis bracket mounting hole diameter',
    body: `Dear Dave,

Understood. The change to a 5.2mm diameter is simple as we can swap the stamping die pin size before the punching stage.
We have registered this update in our internal system as DCN-55201.

There will be no tooling fee adjustment for this modification as it uses a standard catalog punching tool.

Best regards,
Marcus Aurelius
Stamping Department Lead
QSI Manufacturing`
  },
  {
    id: 'email_05',
    subject: 'ECO-10492 - High frequency filter capacitor material substitution',
    body: `To Whom It May Concern,

Due to global supply constraints on specialized tantalum capacitors, we are issuing urgent ECO-10492.
This change allows the assembly line to substitute 10uF tantalum capacitors with 10uF multi-layer ceramic capacitors (MLCC) of equivalent voltage rating.

Please update the BOM immediately so we don't halt the wave soldering line.

Warm regards,
Mike Smith
VP of Procurement
WaveTech Electronics`
  },
  {
    id: 'email_06',
    subject: '(QSI) Ceramic Capacitor Part Sub Approval',
    body: `Hi Procurement Team,

I have authorized the alternative capacitor supplier and updated our manufacturing instruction checklist.
The BOM modification is officially recorded under QSI internal DCN-10948.

Our line supervisors are instructed to load the MLCC components on Reel #4.

Regards,
Linus Torvalds
SMT Assembly Supervisor

-----Original Message-----
From: Mike Smith <mike@wavetech.com>
Sent: Thursday, July 9, 2026 10:14 AM
To: info@qsi-mfg.com
Subject: ECO-10492 - High frequency filter capacitor material substitution

Due to global supply constraints on specialized tantalum capacitors, we are issuing urgent ECO-10492.
This change allows the assembly line to substitute 10uF tantalum capacitors with 10uF multi-layer ceramic capacitors...`
  },
  {
    id: 'email_07',
    subject: 'ECO-30510: Enclosure paint spec update to matte black',
    body: `Hi Sales Team at QSI,

Please implement ECO-30510 on the upcoming batch of metal cabinets. 
The client wants to change the powder coat spec from Glossy White to Matte Black (RAL 9005).

We need this applied for the August shipment of 500 units. Please provide the updated price quote sheet.

Thanks,
Elena Rostova
Industrial Design Director
NeoAesthetic Devices`
  }
];
