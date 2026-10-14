"use client";

import {
  OrganizationFields,
  type OrganizationFieldValues,
} from "@/components/app/organization-fields";
import { HOSTING_LABELS, HOSTING_OPTIONS } from "@/lib/schemas/generator";
import {
  DATA_TYPE_LABELS,
  DATA_TYPES,
  FREE_TEXT_MAX_LENGTH,
  IDENTITY_PROVIDER_LABELS,
  IDENTITY_PROVIDERS,
  MFA_STATUS_LABELS,
  MFA_STATUSES,
  MONITORING_LABELS,
  MONITORING_OPTIONS,
  OUT_OF_BAND_CHANNELS,
  OUT_OF_BAND_LABELS,
  REGULATORY_OBLIGATION_LABELS,
  REGULATORY_OBLIGATIONS,
  REVIEW_CADENCE_LABELS,
  REVIEW_CADENCES,
  ROLE_KEYS,
  ROLE_LABELS,
  type QuestionnaireDraft,
} from "@/lib/schemas/questionnaire";
import {
  CheckboxGroup,
  RadioGroup,
  TextAreaField,
  TextField,
  toOptions,
  type FieldErrors,
} from "./fields";

export type StepProps = {
  answers: QuestionnaireDraft;
  org: OrganizationFieldValues;
  timeZones: string[];
  errors: FieldErrors;
};

const YES_NO_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function Question({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-xl border p-5">
      <h2 className="text-base font-semibold">
        <span className="mr-2 text-muted-foreground">{number}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StepCompany({ answers, org, timeZones, errors }: StepProps) {
  return (
    <>
      <Question number={1} title="Your company">
        <OrganizationFields values={org} errors={errors} timeZones={timeZones} />
      </Question>
      <Question number={2} title="Next audit or renewal">
        <TextField
          name="next_audit_date"
          type="date"
          label="Next audit or insurance renewal date"
          optional
          defaultValue={answers.next_audit_date ?? ""}
          hint="The plan's review schedule works back from this date."
          error={errors.next_audit_date}
          className="max-w-xs"
        />
      </Question>
    </>
  );
}

export function StepSystems({ answers, errors }: StepProps) {
  return (
    <>
      <Question number={3} title="Sensitive data you handle">
        <CheckboxGroup
          name="data_types"
          label="Which of these does the company store or process?"
          hint="Choose all that apply. We never ask for the data itself, only whether you handle it."
          options={toOptions(DATA_TYPES, DATA_TYPE_LABELS)}
          defaultValue={answers.data_types}
          error={errors.data_types}
        />
      </Question>
      <Question number={4} title="Where your systems run">
        <CheckboxGroup
          name="hosting"
          label="Hosting"
          options={toOptions(HOSTING_OPTIONS, HOSTING_LABELS)}
          defaultValue={answers.hosting}
          error={errors.hosting}
          columns={3}
        />
      </Question>
      <Question number={5} title="Identity and MFA">
        <RadioGroup
          name="identity_provider"
          label="Where do people sign in?"
          options={toOptions(IDENTITY_PROVIDERS, IDENTITY_PROVIDER_LABELS)}
          defaultValue={answers.identity_provider}
          error={errors.identity_provider}
        />
        <TextField
          name="identity_provider_other"
          label="If other, which one?"
          optional
          defaultValue={answers.identity_provider_other ?? ""}
          error={errors.identity_provider_other}
          className="max-w-sm"
        />
        <RadioGroup
          name="mfa_status"
          label="Is multi-factor authentication (MFA) enforced?"
          options={toOptions(MFA_STATUSES, MFA_STATUS_LABELS)}
          defaultValue={answers.mfa_status}
          error={errors.mfa_status}
          columns={3}
        />
      </Question>
      <Question number={6} title="Key business systems">
        <TextAreaField
          name="key_systems"
          label="The tools the business runs on"
          rows={4}
          maxLength={FREE_TEXT_MAX_LENGTH}
          defaultValue={answers.key_systems ?? ""}
          placeholder="For example: Google Workspace, Slack, GitHub, Salesforce, QuickBooks, Stripe, a Postgres database on AWS."
          hint={`Up to ${FREE_TEXT_MAX_LENGTH} characters. The plan names these systems, so be specific.`}
          error={errors.key_systems}
        />
      </Question>
    </>
  );
}

export function StepPeople({ answers, errors }: StepProps) {
  return (
    <>
      <Question number={7} title="Who does what in an incident">
        <p className="text-sm text-muted-foreground">
          Role titles are required; names are optional and appear on the plan if given. Name a
          backup where you can, because incidents happen on vacation days.
        </p>
        <div className="space-y-6">
          {ROLE_KEYS.map((key) => (
            <fieldset key={key} className="space-y-3">
              <legend className="text-sm font-medium">{ROLE_LABELS[key]}</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  name={`roles.${key}.title`}
                  label="Role title"
                  defaultValue={answers.roles?.[key]?.title ?? ""}
                  placeholder="e.g. IT Manager"
                  error={errors[`roles.${key}.title`]}
                />
                <TextField
                  name={`roles.${key}.name`}
                  label="Name"
                  optional
                  defaultValue={answers.roles?.[key]?.name ?? ""}
                  error={errors[`roles.${key}.name`]}
                />
                <TextField
                  name={`roles.${key}.backup`}
                  label="Backup"
                  optional
                  defaultValue={answers.roles?.[key]?.backup ?? ""}
                  placeholder="Role or name"
                  error={errors[`roles.${key}.backup`]}
                />
              </div>
            </fieldset>
          ))}
        </div>
      </Question>
      <Question number={8} title="Outside parties">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="outside_parties.msp"
            label="MSP or MSSP"
            optional
            defaultValue={answers.outside_parties?.msp ?? ""}
            placeholder="Company name"
            error={errors["outside_parties.msp"]}
          />
          <TextField
            name="outside_parties.outside_counsel"
            label="Outside counsel"
            optional
            defaultValue={answers.outside_parties?.outside_counsel ?? ""}
            placeholder="Firm name"
            error={errors["outside_parties.outside_counsel"]}
          />
          <TextField
            name="outside_parties.insurer_name"
            label="Cyber insurer"
            optional
            defaultValue={answers.outside_parties?.insurer_name ?? ""}
            error={errors["outside_parties.insurer_name"]}
          />
          <TextField
            name="outside_parties.insurer_claims_phone"
            label="Insurer claims phone"
            optional
            defaultValue={answers.outside_parties?.insurer_claims_phone ?? ""}
            autoComplete="off"
            error={errors["outside_parties.insurer_claims_phone"]}
          />
        </div>
        <RadioGroup
          name="outside_parties.forensics_retainer"
          label="Do you have a forensics retainer (a firm on call to investigate)?"
          options={YES_NO_OPTIONS}
          defaultValue={answers.outside_parties?.forensics_retainer}
          error={errors["outside_parties.forensics_retainer"]}
        />
      </Question>
    </>
  );
}

export function StepDefenses({ answers, errors }: StepProps) {
  return (
    <>
      <Question number={9} title="Monitoring in place">
        <CheckboxGroup
          name="monitoring"
          label="What would tell you something is wrong?"
          options={toOptions(MONITORING_OPTIONS, MONITORING_LABELS)}
          defaultValue={answers.monitoring}
          error={errors.monitoring}
          columns={1}
        />
      </Question>
      <Question number={10} title="Backups">
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            name="backups.location"
            label="Where"
            defaultValue={answers.backups?.location ?? ""}
            placeholder="e.g. AWS Backup, Backblaze"
            error={errors["backups.location"]}
          />
          <TextField
            name="backups.frequency"
            label="How often"
            defaultValue={answers.backups?.frequency ?? ""}
            placeholder="e.g. nightly, kept 30 days"
            error={errors["backups.frequency"]}
          />
          <TextField
            name="backups.last_restore_test"
            label="Last successful restore test"
            defaultValue={answers.backups?.last_restore_test ?? ""}
            placeholder='A date, or "never"'
            error={errors["backups.last_restore_test"]}
          />
        </div>
      </Question>
      <Question number={13} title="If email and Slack are compromised">
        <RadioGroup
          name="out_of_band_channel"
          label="How would the team talk to each other?"
          options={toOptions(OUT_OF_BAND_CHANNELS, OUT_OF_BAND_LABELS)}
          defaultValue={answers.out_of_band_channel}
          error={errors.out_of_band_channel}
        />
        <TextField
          name="out_of_band_details"
          label="Details"
          optional
          defaultValue={answers.out_of_band_details ?? ""}
          placeholder="e.g. the Signal group name, or where the phone list is kept"
          error={errors.out_of_band_details}
        />
      </Question>
      <Question number={14} title="Incidents in the last 24 months">
        <RadioGroup
          name="had_incident"
          label="Has the company had a security incident in the last two years?"
          options={YES_NO_OPTIONS}
          defaultValue={answers.had_incident}
          error={errors.had_incident}
        />
        <TextField
          name="incident_type"
          label="What kind?"
          optional
          defaultValue={answers.incident_type ?? ""}
          placeholder="e.g. a phishing email led to one compromised mailbox"
          error={errors.incident_type}
        />
      </Question>
    </>
  );
}

export function StepObligations({ answers, errors }: StepProps) {
  return (
    <>
      <Question number={11} title="Customer contractual obligations">
        <TextAreaField
          name="customer_notification_obligations"
          label="Notification promises in customer contracts"
          optional
          rows={3}
          maxLength={FREE_TEXT_MAX_LENGTH}
          defaultValue={answers.customer_notification_obligations ?? ""}
          placeholder='For example: "notify within 72 hours of a confirmed breach" in the enterprise MSA.'
          hint="Leave blank if you are not aware of any."
          error={errors.customer_notification_obligations}
        />
      </Question>
      <Question number={12} title="Regulatory notification obligations">
        <CheckboxGroup
          name="regulatory_obligations"
          label="Which of these apply, as far as you know?"
          options={toOptions(REGULATORY_OBLIGATIONS, REGULATORY_OBLIGATION_LABELS)}
          defaultValue={answers.regulatory_obligations}
          error={errors.regulatory_obligations}
          columns={1}
        />
      </Question>
      <Question number={15} title="Review and approval">
        <RadioGroup
          name="review_cadence"
          label="How often will the plan be reviewed?"
          options={toOptions(REVIEW_CADENCES, REVIEW_CADENCE_LABELS)}
          defaultValue={answers.review_cadence}
          error={errors.review_cadence}
          columns={3}
        />
        <TextField
          name="plan_approver"
          label="Approver role"
          defaultValue={answers.plan_approver ?? ""}
          placeholder="e.g. CEO"
          error={errors.plan_approver}
          className="max-w-sm"
        />
      </Question>
    </>
  );
}
