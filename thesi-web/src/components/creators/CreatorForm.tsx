"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCreatorApplicationError } from "@/lib/creatorFormErrors";

const INITIAL_STATE = {
  fullName: "",
  email: "",
  phoneNumber: "",
  country: "",
  city: "",
  creatorType: "",
  tiktokUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  otherLinks: "",
  followerCountRange: "",
  hasUgcExperience: "",
  portfolioLink: "",
  whyClothme: "",
  interestedCreatorStore: "",
  interestedAffiliate: "",
};

function validateForm(form: typeof INITIAL_STATE) {
  if (!form.hasUgcExperience) {
    return "Please indicate whether you have created UGC before.";
  }
  if (!form.interestedCreatorStore) {
    return "Please select your interest in the ClothME Creator Store.";
  }
  if (!form.interestedAffiliate) {
    return "Please select your interest in the Affiliate Program.";
  }
  return "";
}

export function CreatorForm() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...form,
        hasUgcExperience: form.hasUgcExperience === "true",
      };

      const res = await fetch("/api/creator-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Submission failed. Please try again.");
      }

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(parseCreatorApplicationError(json));
      }

      router.push("/creators/success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="creator-apply-wrap">
      <p className="eyebrow">Apply Now</p>
      <h1>Join the Thesi Creator Community</h1>
      <p className="creator-apply-intro">
        We&apos;re selecting founding creators. Fill out the form below — it takes under 3
        minutes.
      </p>

      <form className="creator-form" onSubmit={handleSubmit}>
        <fieldset className="creator-form-fieldset">
          <legend className="creator-form-legend">Personal Info</legend>

          <div className="creator-form-row">
            <div className="creator-form-group">
              <label htmlFor="fullName">
                Full Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Jane Doe"
                required
                autoComplete="name"
              />
            </div>
            <div className="creator-form-group">
              <label htmlFor="email">
                Email <span aria-hidden="true">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="jane@example.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="creator-form-row">
            <div className="creator-form-group">
              <label htmlFor="phoneNumber">
                Phone Number <span className="creator-optional">(optional)</span>
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={form.phoneNumber}
                onChange={handleChange}
                placeholder="+1 555 000 0000"
                autoComplete="tel"
              />
            </div>
            <div className="creator-form-group">
              <label htmlFor="country">
                Country <span aria-hidden="true">*</span>
              </label>
              <select
                id="country"
                name="country"
                value={form.country}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Select country
                </option>
                <option value="USA">🇺🇸 USA</option>
                <option value="Canada">🇨🇦 Canada</option>
              </select>
            </div>
          </div>

          <div className="creator-form-group">
            <label htmlFor="city">
              City <span aria-hidden="true">*</span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              value={form.city}
              onChange={handleChange}
              placeholder="New York"
              required
            />
          </div>
        </fieldset>

        <fieldset className="creator-form-fieldset">
          <legend className="creator-form-legend">Creator Profile</legend>

          <div className="creator-form-group">
            <label htmlFor="creatorType">
              Creator Type <span aria-hidden="true">*</span>
            </label>
            <select
              id="creatorType"
              name="creatorType"
              value={form.creatorType}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select your creator type
              </option>
              <option value="mom_parent">Mom / Parent</option>
              <option value="student">Student</option>
              <option value="fashion_creator">Fashion Creator</option>
              <option value="lifestyle_creator">Lifestyle Creator</option>
              <option value="ugc_creator">UGC Creator</option>
              <option value="gen_z_creator">Gen Z Creator</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="creator-form-row">
            <div className="creator-form-group">
              <label htmlFor="tiktokUrl">
                TikTok URL <span aria-hidden="true">*</span>
              </label>
              <input
                id="tiktokUrl"
                name="tiktokUrl"
                type="url"
                value={form.tiktokUrl}
                onChange={handleChange}
                placeholder="https://tiktok.com/@you"
                required
              />
            </div>
            <div className="creator-form-group">
              <label htmlFor="instagramUrl">
                Instagram URL <span aria-hidden="true">*</span>
              </label>
              <input
                id="instagramUrl"
                name="instagramUrl"
                type="url"
                value={form.instagramUrl}
                onChange={handleChange}
                placeholder="https://instagram.com/you"
                required
              />
            </div>
          </div>

          <div className="creator-form-row">
            <div className="creator-form-group">
              <label htmlFor="youtubeUrl">
                YouTube URL <span className="creator-optional">(optional)</span>
              </label>
              <input
                id="youtubeUrl"
                name="youtubeUrl"
                type="url"
                value={form.youtubeUrl}
                onChange={handleChange}
                placeholder="https://youtube.com/@you"
              />
            </div>
            <div className="creator-form-group">
              <label htmlFor="otherLinks">
                Other Links <span className="creator-optional">(optional)</span>
              </label>
              <input
                id="otherLinks"
                name="otherLinks"
                type="text"
                value={form.otherLinks}
                onChange={handleChange}
                placeholder="Linktree, Pinterest, etc."
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="creator-form-fieldset">
          <legend className="creator-form-legend">Your Audience</legend>

          <div className="creator-form-group">
            <label htmlFor="followerCountRange">
              Follower Count Range <span aria-hidden="true">*</span>
            </label>
            <select
              id="followerCountRange"
              name="followerCountRange"
              value={form.followerCountRange}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select range
              </option>
              <option value="0-500">0 – 500</option>
              <option value="500-1K">500 – 1K</option>
              <option value="1K-5K">1K – 5K</option>
              <option value="5K+">5K+</option>
            </select>
          </div>

          <div className="creator-form-group">
            <label>
              Have you created UGC before? <span aria-hidden="true">*</span>
            </label>
            <div className="creator-radio-group">
              <label className="creator-radio-label">
                <input
                  type="radio"
                  name="hasUgcExperience"
                  value="true"
                  checked={form.hasUgcExperience === "true"}
                  onChange={handleChange}
                  required
                />
                Yes
              </label>
              <label className="creator-radio-label">
                <input
                  type="radio"
                  name="hasUgcExperience"
                  value="false"
                  checked={form.hasUgcExperience === "false"}
                  onChange={handleChange}
                />
                No
              </label>
            </div>
          </div>

          <div className="creator-form-group">
            <label htmlFor="portfolioLink">
              Portfolio / Example Video Link <span aria-hidden="true">*</span>
            </label>
            <input
              id="portfolioLink"
              name="portfolioLink"
              type="url"
              value={form.portfolioLink}
              onChange={handleChange}
              placeholder="https://drive.google.com/... or TikTok/Instagram link"
              required
            />
          </div>
        </fieldset>

        <fieldset className="creator-form-fieldset">
          <legend className="creator-form-legend">Your Story</legend>

          <div className="creator-form-group">
            <label htmlFor="whyClothme">
              Why do you want to join Thesi? <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="whyClothme"
              name="whyClothme"
              value={form.whyClothme}
              onChange={handleChange}
              placeholder="Tell us what excites you about Thesi and what you'd bring as a creator..."
              rows={4}
              required
            />
          </div>

          <div className="creator-form-group">
            <label>
              Would you be interested in selling products through your own ClothME Creator
              Store? <span aria-hidden="true">*</span>
            </label>
            <div className="creator-radio-group">
              {[
                { value: "yes", label: "Yes, definitely" },
                { value: "maybe", label: "Maybe, tell me more" },
                { value: "no", label: "Not right now" },
              ].map(({ value, label }) => (
                <label key={value} className="creator-radio-label">
                  <input
                    type="radio"
                    name="interestedCreatorStore"
                    value={value}
                    checked={form.interestedCreatorStore === value}
                    onChange={handleChange}
                    required
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="creator-form-group">
            <label>
              Would you like to earn through our Affiliate Program?{" "}
              <span aria-hidden="true">*</span>
            </label>
            <p className="creator-field-hint">
              Automatically set up with your account — recommend products and earn a commission
              on every sale.
            </p>
            <div className="creator-radio-group">
              {[
                { value: "yes", label: "Yes, sign me up" },
                { value: "maybe", label: "Tell me more first" },
                { value: "no", label: "Not right now" },
              ].map(({ value, label }) => (
                <label key={value} className="creator-radio-label">
                  <input
                    type="radio"
                    name="interestedAffiliate"
                    value={value}
                    checked={form.interestedAffiliate === value}
                    onChange={handleChange}
                    required
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {error && (
          <p className="creator-form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="creator-submit" disabled={loading}>
          {loading ? "Submitting…" : "Submit Application"}
        </button>

        <p className="privacy-note">
          We review every application. Selected creators will be contacted by email.
        </p>
      </form>
    </div>
  );
}
