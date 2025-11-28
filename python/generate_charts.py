import pandas as pd
import pycountry_convert as pc
import altair as alt
import geopandas as gpd

""" Load and clean the data """

df = pd.read_csv('../data/Global Health.csv')

def clean_col(name):
    name = name.lower()
    return name

def country_to_continent(country_name):
    try:
        # Get country code
        country_code = pc.country_name_to_country_alpha2(country_name, cn_name_format="default")
        # Get continent code
        continent_code = pc.country_alpha2_to_continent_code(country_code)
        # Get continent name
        continent_name = pc.convert_continent_code_to_continent_name(continent_code)
        return continent_name
    except:
        return None

df.columns = [clean_col(c) for c in df.columns]

# Remove duplicates
df = df.drop_duplicates()

# country, gender --> categorical
if 'country' in df.columns:
    df['country'] = df['country'].astype('category')
if 'gender' in df.columns:
    df['gender'] = df['gender'].astype('category')

# year --> integer type
if 'year' in df.columns:
    df['year'] = pd.to_numeric(df['year'], errors='coerce').astype('Int64')

# Convert other string columns to numeric when possible
for col in df.columns:
    if df[col].dtype == object and col not in ['country', 'gender']:
        df[col] = pd.to_numeric(df[col], errors='ignore')

df_both = df[df["gender"] == "Both sexes"]
df_both["continent"] = df_both['country'].apply(country_to_continent)

alt.data_transformers.disable_max_rows()

""" Scatter plot: Diet Composition - Fruit and Vegetables vs Life Expectancy """

# Remove null values in the alcoholic beverages column
df_scatter = df_both.dropna(subset=['diet composition fruit and vegetables', 'life expectancy'])

# Create the scatter plot with points colored by continent
scatter = alt.Chart(df_scatter).mark_circle(size=60, opacity=0.7).encode(
    x=alt.X('diet composition fruit and vegetables:Q',
            title='Diet Composition - Fruit and Vegetables (kcal/person/day)'),
    y=alt.Y('life expectancy:Q',
            title='Life Expectancy (years)'),
    color=alt.Color('continent:N',
                    title='Continent',
                    scale=alt.Scale(scheme='category10')),
    tooltip=[
        alt.Tooltip('country:N', title='Country'),
        alt.Tooltip('diet composition fruit and vegetables:Q', title='Fruit & Vegetable %', format='.2f'),
        alt.Tooltip('life expectancy:Q', title='Life Expectancy', format='.2f'),
        alt.Tooltip('continent:N', title='Continent')
    ]
).properties(
    width=700,
    height=500,
    title='Relationship between Fruit & Vegetable Composition and Life Expectancy by Continent'
)

# Create LOWESS curve (line of best fit)
lowess_curve = alt.Chart(df_scatter).transform_loess(
    'diet composition fruit and vegetables',
    'life expectancy',
    bandwidth=0.3  # Adjust this for smoothness (0.1-1.0)
).mark_line(
    color='black',
    strokeWidth=3,
    opacity=0.8
).encode(
    x='diet composition fruit and vegetables:Q',
    y='life expectancy:Q'
)

# Combine scatter plot and LOWESS curve
final_plot = (scatter + lowess_curve).interactive()

final_plot.save('../charts/fruit_vegetable_life_expectancy.html')


""" Animated Bubble Chart: GDP per Capita vs Life Expectancy over Time """

# Prepare data - drop nulls for the required columns
df_gapminder = df_both.dropna(subset=['gdp per capita', 'life expectancy', 'total population', 'continent', 'year']).copy()

# Get year range
years = sorted(df_gapminder['year'].unique())
print(f"Year range: {years[0]} to {years[-1]}")
print(f"Number of countries: {df_gapminder['country'].nunique()}")

# Create the animated bubble chart
bubble_chart = alt.Chart(df_gapminder).mark_circle(
    opacity=0.7,
    stroke='black',
    strokeWidth=0.5
).encode(
    x=alt.X('gdp per capita:Q',
            scale=alt.Scale(type='log', domain=[100, 100000]),
            axis=alt.Axis(title='GDP per Capita ($, log scale)', format='$,.0f'),
            ),
    y=alt.Y('life expectancy:Q',
            scale=alt.Scale(domain=[40, 90]),
            axis=alt.Axis(title='Life Expectancy (years)')),
    size=alt.Size('total population:Q',
                  scale=alt.Scale(range=[10, 2000], type='sqrt'),
                  legend=alt.Legend(title='Population', format='.2s')),
    color=alt.Color('continent:N',
                    scale=alt.Scale(scheme='category10'),
                    legend=alt.Legend(title='Continent')),
    tooltip=[
        alt.Tooltip('country:N', title='Country'),
        alt.Tooltip('year:O', title='Year'),
        alt.Tooltip('gdp per capita:Q', title='GDP per Capita', format='$,.0f'),
        alt.Tooltip('life expectancy:Q', title='Life Expectancy', format='.1f'),
        alt.Tooltip('total population:Q', title='Population', format=',.0f'),
        alt.Tooltip('continent:N', title='Continent')
    ]
).properties(
    width=800,
    height=500,
    title={
        "text": "The Wealth and Health of Nations",
        "subtitle": "GDP per Capita vs Life Expectancy (1990-2019)",
        "fontSize": 20,
        "subtitleFontSize": 14
    }
)

# Add year slider for animation
year_slider = alt.binding_range(
    min=int(years[0]),
    max=int(years[-1]),
    step=1,
    name='Year: '
)

year_selection = alt.selection_point(
    fields=['year'],
    bind=year_slider,
    value=int(years[0])
)

# Apply selection and filter
animated_chart = bubble_chart.add_params(
    year_selection
).transform_filter(
    year_selection
).interactive()

# Display
animated_chart.save('../charts/gdp_life_expectancy_bubble_chart.html')