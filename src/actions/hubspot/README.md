# Hubspot

## Add properties to your Hubspot contacts and companies.

The Hubspot action allows you to add properties to your contacts and companies (tagged dimension with either `hubspot_contact_id`, or `hubspot_company_id`) via the Hubspot V3 API.

For the Hubspot Contacts action, we'll want to tag the Looker field that brings in the internal contact_id field from Hubspot. This field is API-only on the Hubspot end, and can be grabbed via the API a couple ways - here's an example with the contact email https://legacydocs.hubspot.com/docs/methods/contacts/get_contact_by_email. This is returned as the vid in the response. 

Similarly, for the Hubspot Companies action, we will want to tag the Looker field that brings in the internal company_id field from Hubspot. We can use this endpoint https://legacydocs.hubspot.com/docs/methods/companies/get_company to grab the company_id. 
