# Marketo
## Send leads from an Explore into a campaign in Marketo

This action allows you to push rows from an explore in Looker to a campaign in Marketo. It requires some setup 
so the Action hub knows which columns belong in which fields.

1. Enable Marketo in your looker Administration page for actions (/admin/actions).
    - Enter the URL for your identity and rest endpoints
    - Enter your client ID and secret.
    
2. Tag the columns you'd like to send over in your model.
    - The tag should follow the form "marketo:\<marketo field name\>"
    - It's okay if the field has other tags too. ![](marketo_tag.png)
    
3. Run the explore that generates the rows you want to push to Marketo.
    - Click the gear icon, then send, then choose Marketo as the destination.
    - Enter the id of the campaign you'd like to send the leads to.
    - Hit send and let the magic happen.
