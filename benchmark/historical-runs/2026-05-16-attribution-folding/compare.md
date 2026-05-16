# Compare Results — 2026-05-16T05:41:10.420Z

Change axes: `prompt`, `atomizer`
Control run at: 2026-05-15T19:26:34.418Z
Treatment run at: 2026-05-16T05:34:42.533Z

Compared cells: **1405** of 1477 intersection (185 control-only, 3 treatment-only excluded). Dataset: 176 valid of 189.
Noise floor: ±5pp (single-provider 95% CI heuristic).

## Headline accuracy

| Provider | n | Control exact | Treatment exact | Δ exact | Control lenient | Treatment lenient | Δ lenient | Control binary | Treatment binary | Δ binary |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| claude-sonnet-4-5 (noise) | 176 | 58.5% | 58.5% | +0.0 | 76.7% | 75.0% | -1.7 | 76.7% | 75.0% | -1.7 |
| gemini-2.5-flash (noise) | 174 | 60.9% | 64.4% | +3.4 | 76.4% | 77.6% | +1.1 | 76.4% | 77.6% | +1.1 |
| openrouter-mistral-small-3.2 (noise) | 176 | 60.2% | 63.1% | +2.8 | 80.1% | 80.1% | +0.0 | 80.1% | 80.1% | +0.0 |
| openrouter-gemma-4-26b-a4b (noise) | 176 | 54.5% | 55.1% | +0.6 | 73.9% | 71.0% | -2.8 | 73.9% | 71.0% | -2.8 |
| openrouter-granite-4.1-8b | 175 | 57.7% | 62.9% | +5.1 | 78.9% | 78.9% | +0.0 | 78.9% | 78.9% | +0.0 |
| openrouter-qwen-3-32b | 176 | 56.3% | 61.4% | +5.1 | 77.8% | 77.3% | -0.6 | 77.8% | 77.3% | -0.6 |
| hf-qwen3-32b | 176 | 54.5% | 60.2% | +5.7 | 75.6% | 75.6% | +0.0 | 75.6% | 75.6% | +0.0 |
| hf-deepseek-v3 | 176 | 64.2% | 71.0% | +6.8 | 81.8% | 84.7% | +2.8 | 81.8% | 84.7% | +2.8 |

## Flips

| Provider | Entry ID | Claim | Control | Treatment | Ground truth | Direction |
|---|---|---|---|---|---|---|
| claude-sonnet-4-5 | row_2 | Immigration has been a major source of population growth and… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_3 | While the United States represented about 4% of the total gl… | NOT SUPPORTED | PARTIALLY SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_5 | In 2024, immigrants and their U.S.-born children number more… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_15 | During the 17th century, approximately 400,000 English peopl… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_16 | Over half of all European immigrants to Colonial America dur… | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_30 | PLC forces captured the city's international airport and the… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_40 | That evening, Benomar announced an agreement that would end … | SUPPORTED | NOT SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_46 | Al Jazeera later claimed to have received taped phone conver… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_47 | Saleh's party, the General People's Congress, joined the Hou… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_54 | President Maskhadov started a major campaign against hostage… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_58 | Dancers Fred Astaire and Ginger Rogers are represented in th… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_61 | AJMN receives public funding from the Qatari government, and… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_60 | AJMN receives public funding from the Qatari government, and… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_68 | The original settlement area contained the site of the Chart… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_83 | Retired Australian Army Major General Mick Ryan characterize… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_85 | Those who reached Almería were largely rejected by the city’… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| claude-sonnet-4-5 | row_97 | Shreve's literary works have been featured in The New Yorker… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_112 | Since 2013, she has guest-starred in several episodes of Law… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_119 | At the time, he was a member of the House General Investigat… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_122 | Alexander Muss prioritizes safety for their students and wor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_131 | In December 2024, the House of Lords recommended that Lord S… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_130 | It defines itself as a home for the growing community of dev… | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_132 | Based on polo, two players moved miniature motorbikes around… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_133 | In December 2008, Bettencourt stepped down from his role sho… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_135 | There, she completed her doctoral training and collaborated … | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_140 | Thagunna made his Twenty20 International (T20I) debut for Ne… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_141 | She became a full member of the European Parliament Committe… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_157 | During recovery, he would watch Janet Jackson's video anthol… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_158 | Its goal is to allow consumers to compare the overall nutrit… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_165 | The 1980 NBA Finals was dramatized in the Season 1 of HBO's … | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| claude-sonnet-4-5 | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_171 | United Records operated during a period of rapid growth in t… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| claude-sonnet-4-5 | row_173 | First Nations peoples believe that the berry has many health… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_4 | In March 2025, the Federation for American Immigration Refor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_2 | Immigration has been a major source of population growth and… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_4 | In March 2025, the Federation for American Immigration Refor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_4 | In March 2025, the Federation for American Immigration Refor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_4 | In March 2025, the Federation for American Immigration Refor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_19 | By comparison, in the first federal census, in 1790, the pop… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-qwen-3-32b | row_4 | In March 2025, the Federation for American Immigration Refor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_24 | On 7 January 2026, Yemeni government forces (Presidential Le… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_36 | In August, the Houthis began holding mass demonstrations in … | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_9 | of these ethnic quotas with per-country limits for family-sp… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_9 | of these ethnic quotas with per-country limits for family-sp… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_40 | That evening, Benomar announced an agreement that would end … | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-mistral-small-3.2 | row_11 | In 2017, out of the U.S. foreign-born population, some 45% (… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_44 | The rebels signed a deal with the government, prompting Prim… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_12 | The United States led the world in refugee resettlement for … | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_47 | Saleh's party, the General People's Congress, joined the Hou… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_13 | Causes of migration include poverty, crime | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_15 | During the 17th century, approximately 400,000 English peopl… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_15 | During the 17th century, approximately 400,000 English peopl… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_15 | During the 17th century, approximately 400,000 English peopl… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_83 | Retired Australian Army Major General Mick Ryan characterize… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_85 | Those who reached Almería were largely rejected by the city’… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| gemini-2.5-flash | row_97 | Shreve's literary works have been featured in The New Yorker… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_21 | The peak year of European immigration was in 1907, when 1,28… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_104 | As of December 2024, the company operates six locations: one… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_24 | On 7 January 2026, Yemeni government forces (Presidential Le… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_112 | Since 2013, she has guest-starred in several episodes of Law… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_19 | By comparison, in the first federal census, in 1790, the pop… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_25 | Following Aden's capture, the secretary-general of the STC a… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_27 | A few weeks later, the Battle of Aden broke out between the … | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-qwen-3-32b | row_25 | Following Aden's capture, the secretary-general of the STC a… | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_129 | Any movement, especially rapid or unguarded movement, can ag… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_133 | In December 2008, Bettencourt stepped down from his role sho… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_27 | A few weeks later, the Battle of Aden broke out between the … | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-qwen-3-32b | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_158 | Its goal is to allow consumers to compare the overall nutrit… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| gemini-2.5-flash | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_171 | United Records operated during a period of rapid growth in t… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-gemma-4-26b-a4b | row_34 | The flag of Yemen was raised over government buildings in th… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_178 | This creates a new way for native areas to get extra revenue… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_37 | Fighting broke out between the Houthis and army units in nor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_179 | These groups are fighting for gender equailty and continuing… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | NOT SUPPORTED | PARTIALLY SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_184 | It is managed as part of the Nature Reserve of Orange County… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_37 | Fighting broke out between the Houthis and army units in nor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_40 | That evening, Benomar announced an agreement that would end … | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_40 | That evening, Benomar announced an agreement that would end … | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_40 | That evening, Benomar announced an agreement that would end … | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_40 | That evening, Benomar announced an agreement that would end … | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-mistral-small-3.2 | row_42 | having taken over the offices of the prime minister, the sta… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_41 | By 21 September, the Houthis declared themselves in control … | SUPPORTED | NOT SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_42 | having taken over the offices of the prime minister, the sta… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_43 | although the general himself was believed to have escaped ca… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_44 | The rebels signed a deal with the government, prompting Prim… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_44 | The rebels signed a deal with the government, prompting Prim… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_38 | Flights into and out of Sanaa International Airport were sus… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_47 | Saleh's party, the General People's Congress, joined the Hou… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_47 | Saleh's party, the General People's Congress, joined the Hou… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_47 | Saleh's party, the General People's Congress, joined the Hou… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-qwen-3-32b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_59 | In 2016, over the course of five months, two floors of the b… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_62 | The Qatar cabinet nominates the network's leaders, who are t… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_61 | AJMN receives public funding from the Qatari government, and… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_62 | The Qatar cabinet nominates the network's leaders, who are t… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_68 | The original settlement area contained the site of the Chart… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_71 | In April 1984, the LTTE formally joined a common militant fr… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_71 | In April 1984, the LTTE formally joined a common militant fr… | NOT SUPPORTED | SUPPORTED | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_72 | On 23 July 1992, the Abkhaz faction of Abkhazia's legislativ… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_72 | On 23 July 1992, the Abkhaz faction of Abkhazia's legislativ… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_76 | In 2002, Rwanda's situation in the war began to worsen. Many… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-gemma-4-26b-a4b | row_78 | to Jessica Roesler Gund, and George Gund II. | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_79 | His educational background is in marine biology, and Hemphil… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-granite-4.1-8b | row_81 | In 1985 he gave the UK premiere of Erich Wolfgang Korngold's… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-gemma-4-26b-a4b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_85 | Those who reached Almería were largely rejected by the city’… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_85 | Those who reached Almería were largely rejected by the city’… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_85 | Those who reached Almería were largely rejected by the city’… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_88 | Kask died after a short illness on December 30, 2025, at the… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-qwen-3-32b | row_88 | Kask died after a short illness on December 30, 2025, at the… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_90 | In June, Ajnad al-Sham along with more rebel groups led a ne… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-qwen-3-32b | row_89 | University Radio York (URY) is the oldest independent radio … | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_90 | In June, Ajnad al-Sham along with more rebel groups led a ne… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_97 | Shreve's literary works have been featured in The New Yorker… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_97 | Shreve's literary works have been featured in The New Yorker… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_100 | and the Minister of Interior in the Syrian transitional gove… | PARTIALLY SUPPORTED | SUPPORTED | Not supported | lateral |
| openrouter-qwen-3-32b | row_104 | As of December 2024, the company operates six locations: one… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_104 | As of December 2024, the company operates six locations: one… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_105 | Harris's body was cremated, and his ashes were scattered in … | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_112 | Since 2013, she has guest-starred in several episodes of Law… | NOT SUPPORTED | SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_112 | Since 2013, she has guest-starred in several episodes of Law… | NOT SUPPORTED | SUPPORTED | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_112 | Since 2013, she has guest-starred in several episodes of Law… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_112 | Since 2013, she has guest-starred in several episodes of Law… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_115 | Later, in December 2025, a Gadsden County jury awarded a $77… | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-qwen-3-32b | row_118 | Adas Israel has played an important role in the nation's cap… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_122 | Alexander Muss prioritizes safety for their students and wor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-qwen-3-32b | row_119 | At the time, he was a member of the House General Investigat… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_128 | Republicans should be ashamed of exploiting this tragedy for… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_129 | Any movement, especially rapid or unguarded movement, can ag… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_131 | In December 2024, the House of Lords recommended that Lord S… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_133 | In December 2008, Bettencourt stepped down from his role sho… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_133 | In December 2008, Bettencourt stepped down from his role sho… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-mistral-small-3.2 | row_135 | There, she completed her doctoral training and collaborated … | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_133 | In December 2008, Bettencourt stepped down from his role sho… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_135 | There, she completed her doctoral training and collaborated … | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_136 | Only to make the team feel uneasy and are feeling the strong… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_135 | There, she completed her doctoral training and collaborated … | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_137 | LaGuardia Airport, United States, 2025 | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_143 | His comments on Middle Eastern politics have drawn criticism… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-granite-4.1-8b | row_143 | His comments on Middle Eastern politics have drawn criticism… | NOT SUPPORTED | SUPPORTED | Not supported | regression |
| openrouter-qwen-3-32b | row_142 | The façade features a double row of arches and, despite modi… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_155 | COM is well regarded among communication colleges in the Uni… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_158 | Its goal is to allow consumers to compare the overall nutrit… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_157 | During recovery, he would watch Janet Jackson's video anthol… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_157 | During recovery, he would watch Janet Jackson's video anthol… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_159 | The college is also recognized as a Military Friendly® Schoo… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_164 | Some mentionable connections and collaborations from this pe… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_163 | Route 22 Confederation/City Centre (this route operates as n… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_165 | The 1980 NBA Finals was dramatized in the Season 1 of HBO's … | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| openrouter-granite-4.1-8b | row_166 | O'Neal, president of the American Farm Bureau, Duncan eventu… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_170 | The film was based on a real-life incident of a friend of Ba… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-granite-4.1-8b | row_171 | United Records operated during a period of rapid growth in t… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-granite-4.1-8b | row_172 | If you live in an area with low or moderate flood risk, you … | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_173 | First Nations peoples believe that the berry has many health… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_173 | First Nations peoples believe that the berry has many health… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_172 | If you live in an area with low or moderate flood risk, you … | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_174 | Future missions may use radiation-resistant fungi-derived pa… | NOT SUPPORTED | SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_176 | Previous historical uses of the term “mascarpone” may not ha… | NOT SUPPORTED | SUPPORTED | Partially supported | lateral |
| openrouter-mistral-small-3.2 | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | NOT SUPPORTED | PARTIALLY SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_181 | Berguer was born in 1940 in A Coruña, Spain. | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | NOT SUPPORTED | SUPPORTED | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_183 | The following year, qualification was achieved for the FIFA … | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_187 | The summit also called upon Israel to relinquish it's occupa… | NOT SUPPORTED | SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_188 | The current church building, dating from 1867, had been unde… | SUPPORTED | PARTIALLY SUPPORTED | Not supported | lateral |
| hf-qwen3-32b | row_4 | In March 2025, the Federation for American Immigration Refor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_4 | In March 2025, the Federation for American Immigration Refor… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_5 | In 2024, immigrants and their U.S.-born children number more… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_11 | In 2017, out of the U.S. foreign-born population, some 45% (… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_13 | Causes of migration include poverty, crime | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_15 | During the 17th century, approximately 400,000 English peopl… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_16 | Over half of all European immigrants to Colonial America dur… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_25 | Following Aden's capture, the secretary-general of the STC a… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_26 | Aden has changed hands several times over the course of the … | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-deepseek-v3 | row_26 | Aden has changed hands several times over the course of the … | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_27 | A few weeks later, the Battle of Aden broke out between the … | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_33 | The Yemeni government charged Zoubaidi with high treason on … | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_34 | The flag of Yemen was raised over government buildings in th… | SUPPORTED | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_38 | Flights into and out of Sanaa International Airport were sus… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_40 | That evening, Benomar announced an agreement that would end … | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_47 | Saleh's party, the General People's Congress, joined the Hou… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_54 | President Maskhadov started a major campaign against hostage… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_61 | AJMN receives public funding from the Qatari government, and… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_75 | According to various estimates, the number of Chechens who a… | SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| hf-deepseek-v3 | row_76 | In 2002, Rwanda's situation in the war began to worsen. Many… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| hf-qwen3-32b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_83 | Retired Australian Army Major General Mick Ryan characterize… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_85 | Those who reached Almería were largely rejected by the city’… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_85 | Those who reached Almería were largely rejected by the city’… | PARTIALLY SUPPORTED | NOT SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| hf-deepseek-v3 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| hf-qwen3-32b | row_97 | Shreve's literary works have been featured in The New Yorker… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_97 | Shreve's literary works have been featured in The New Yorker… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_104 | As of December 2024, the company operates six locations: one… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| hf-deepseek-v3 | row_104 | As of December 2024, the company operates six locations: one… | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| hf-qwen3-32b | row_112 | Since 2013, she has guest-starred in several episodes of Law… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_112 | Since 2013, she has guest-starred in several episodes of Law… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_119 | At the time, he was a member of the House General Investigat… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | PARTIALLY SUPPORTED | SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_131 | In December 2024, the House of Lords recommended that Lord S… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_131 | In December 2024, the House of Lords recommended that Lord S… | PARTIALLY SUPPORTED | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_132 | Based on polo, two players moved miniature motorbikes around… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_133 | In December 2008, Bettencourt stepped down from his role sho… | PARTIALLY SUPPORTED | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_135 | There, she completed her doctoral training and collaborated … | NOT SUPPORTED | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_140 | Thagunna made his Twenty20 International (T20I) debut for Ne… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_142 | The façade features a double row of arches and, despite modi… | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_161 | From 1968 through 2004, the majority of North Carolina voter… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_163 | Route 22 Confederation/City Centre (this route operates as n… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_165 | The 1980 NBA Finals was dramatized in the Season 1 of HBO's … | PARTIALLY SUPPORTED | NOT SUPPORTED | Not supported | improvement |
| hf-qwen3-32b | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_167 | Other risk factors for developing adhesive capsulitis includ… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_171 | United Records operated during a period of rapid growth in t… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
| hf-qwen3-32b | row_172 | If you live in an area with low or moderate flood risk, you … | SUPPORTED | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_178 | This creates a new way for native areas to get extra revenue… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_178 | This creates a new way for native areas to get extra revenue… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_184 | It is managed as part of the Nature Reserve of Orange County… | NOT SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_187 | The summit also called upon Israel to relinquish it's occupa… | SUPPORTED | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_188 | The current church building, dating from 1867, had been unde… | NOT SUPPORTED | PARTIALLY SUPPORTED | Not supported | regression |
