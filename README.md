# Create an Alexa Radio Skill in 5 Minutes

Create your own Alexa Radio Skill with your favourite streaming stations. Once deployed, you can say `Alexa, open radio` and Alexa will start streaming your custom streaming station. 

You can also ask Alexa for a channel or a station by name. If you say Alexa, ask radio to play Blues, the skill will first search for a channel and then the stations. If a channel is found, a random station from that channel is played.

## Feature list

- A responsive web page to add and delete your channels and stations.
- Alexa responses can be customized using the web page. Change what the skill says for Now playing, Next etc. Change them as often as you wish. 
- Support for audiobooks. If the streaming link is an MP3 file, progress is saved. If your channel contains multiple MP3 files, the skill wil queue up the next file automatically (If shuffle is off)
- Alexa Interaction model updated to use a custom slot. You can search by channel or station name


## Usage

Deploying it is incredibly easy thanks to [Standard Library](https://stdlib.com/). It involves two steps and lots of button clicking and some copy pasta.

### Step 1

Right-Click on the button below to deploy the code to stdlib.

[<img src="https://deploy.stdlib.com/static/images/deploy.svg" width="192">](https://deploy.stdlib.com/)

On the new page, click on the Generate Identity button. Once that's done, click on the Deploy Project button under it to deploy the code.
![Screenshot 1](./data/tutorial/Screenshot1.png?raw=true "Screenshot 1")

Once deployed, you'll see this page.