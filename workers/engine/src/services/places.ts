import type { Place } from "@outreach-engine/types";

export interface PlacesSearchResponse {
  places: Place[];
  nextPageToken?: string;
}

export class PlacesApiClient {
  private apiKey: string;
  private readonly API_URL = "https://places.googleapis.com/v1/places:searchText";
  private readonly FIELD_MASK =
    "places.id,places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.photos,places.regularOpeningHours";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search for businesses using text query.
   * Tight field mask per spec §5 to minimize billing tier.
   */
  async searchText(
    query: string,
    pageToken?: string
  ): Promise<PlacesSearchResponse> {
    const body: any = { textQuery: query };
    if (pageToken) {
      body.pageToken = pageToken;
    }

    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": this.FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Places API error (${response.status}): ${error}`
      );
    }

    const data = await response.json();
    return {
      places: (data.places || []).map(this.normalizePlace),
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Normalize Places API response to our Place type.
   */
  private normalizePlace(place: any): Place {
    return {
      id: place.id,
      displayName: place.displayName?.text || place.displayName || "",
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      websiteUri: place.websiteUri,
      nationalPhoneNumber: place.nationalPhoneNumber,
      photos: place.photos,
    };
  }

  /**
   * Helper to extract phone number with retry logic.
   */
  static extractPhone(phone: string | undefined): string | undefined {
    if (!phone) return undefined;
    // Clean up formatting
    return phone.replace(/[^\d+\-()]/g, "").trim();
  }

  /**
   * Helper to extract email (Places API doesn't return email, must be scraped).
   */
  static extractEmail(html: string): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = html.match(emailRegex);
    return match ? match[0] : undefined;
  }

  /**
   * Helper to extract Instagram from HTML or URL.
   */
  static extractInstagram(
    html: string,
    websiteUri?: string
  ): string | undefined {
    // Try to find Instagram URL in HTML
    const instagramRegex =
      /(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9_\.]+/;
    let match = html.match(instagramRegex);
    if (match) return match[0];

    // Try website URI if provided
    if (websiteUri && websiteUri.includes("instagram.com")) {
      return websiteUri;
    }

    return undefined;
  }
}

export function createPlacesClient(apiKey: string) {
  return new PlacesApiClient(apiKey);
}
