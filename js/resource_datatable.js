var Airtable = require('airtable');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: WRITE_API_KEY
});
var base = Airtable.base('app2FkHOwb0jN0G8v');

// When the page loads populate the table with activities and render the dropdown menus.
// Add a graderange to each activity that JS can interpret
$(document).ready(function(){
    // console.log('table length ' + resource_table.Activities.length);
    // _buildTable();
    _renderSelects();
    _setupFeatures();
    _handleSearch();

    $('.grid-container').hide();
    $('#search').click(function() {renderTableAjax()});
    $('#reset').click(function() {resetFilters()});
    $('#uncheck-materials').click(function() {
        $(':checkbox').prop('checked', false);
    });
});

/*
    Render the datatable with activities filtered by user
    @param {boolean} search - 'true' if user has filtered activities. 
        'false' if the whole table should be rendered
    search is becoming a default condition for rendering the table, which means we could remove it as an argument
*/
function renderTable() {
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    console.log('filter by formula: ' + query_string);
    $('.grid-container').show();
    var search_results = [];
    base('Activities').select({
        view: 'Grid view',
        filterByFormula: query_string
    }).firstPage(function(err, records) {
        if (err) { console.error(err); return; }
        records.forEach(function(record) {
            search_results.push(record.fields);
        });
        _renderFeatures(search_results);
        _buildTable(search_results);
        document.querySelector('.features').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

function renderTableAjax(search=true) {
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    console.log('filter by formula: ' + query_string);
    $('.grid-container').show();
    search_results = [];
    var url = "https://wmsinh.org/airtable?query=" + query_string;
    // var url = "http://localhost:5000/airtable?query=" + query_string;
    console.log('getting ' + url);
    // $.get(url, function(data) {
    //     console.log('received ' + data);
    // });
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url
    }).done(function(data, status) {
        search_results=JSON.parse(data);
        _renderFeatures(search_results);
        _buildTable(search_results);
        document.querySelector('.features').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
    return;
}

/*
    Render 3 Featured Activities at the top of the page. 
    Call helper function to build ordered list of relevant features 
    based on ratings and other criteria.
    @param {array} search_results - list of activites returned based on a user search

    TODO: Refine selection criteria, limit duplicate Source
*/
function _renderFeatures(search_results) {
    console.log('rendering features');
    feature_list = _buildFeatureList(search_results);
    console.log('building ' + feature_list.length + ' features');
    _buildFeatures(feature_list);
}

/*
    Add 3 features to the top of the page. 
    For now these can be any activities with thumbnails in the base.
    @private
*/
function _setupFeatures() {
    var search_results = [];
    base('Activities').select({
        view: 'Grid view',
        filterByFormula: "NOT({Thumbnail} = '')"
    }).firstPage(function(err, records) {
        if (err) { console.error(err); return; }
        // records = records.slice(0,3);
        records.forEach(function(record) {
            search_results.push(record.fields);
        });
        feature_list = _buildFeatureList(search_results);
        console.log('building from ' + feature_list.length + ' features');
        _buildFeatures(feature_list);
    });
}

/*
    Create three features to appear above the table. Features can fit whatever criteria we want-
    Right now the first one always comes from a list of 'best authors' and the other two are random
    @param {array} features - a list of activities that could be used as features. Currently this
        is all activities with an "Img URL" field
    @private
*/
function _buildFeatures(features) {
    
    $(".featured-activity").each(function(i) {
        $(this).empty();
        if(!features[i])
            return true;
        var feature_id = 'feature' + (i + 1);
        var subjects = Array.isArray(features[i]["Subject"]) ? features[i]["Subject"].join(", ") : features[i]["Subject"];
        var feature_div = `
            <a href="#" data-featherlight="#`+ feature_id +`"><div class="feature"><img class="feature" src="`+ features[i]["Thumbnail"][0].url +`" /></div><br />
            <span>`+ features[i]["Resource Name"] +`</span></a>
                <div style="display: none"><div id="`+ feature_id +`" style="padding: 10px;">
                    <h3><a target="_blank" href="`+ features[i]["Resource Link"] +`">`+ features[i]["Resource Name"] +`</a></h3>
                    <br />`+ features[i]["Description"] +`<br /><br />
                    <b>Experience: </b>`+ features[i]["Experience"] +`<br />
                    <b>Subject: </b>`+ subjects +`<br />
                    <b>Materials: </b>`+ features[i]["Materials"] +`<br />
                    <b>Author: </b><a href="`+ features[i]["Source Link"] +`">`+ features[i]["Source"] +`</a><br>   
                    <b>Rating: </b>` + _starsMarkup(features[i]) + `
                </div>`;
        $(this).append(feature_div);
    });
}

/*
    Clear the table from previous search results
    @private
*/
function _clearTable() {
    $('.item').remove();
    $('.ligthbox-grid').remove();
}

/*
    Start a new search if the user presses "Enter" after typing in the search box.
    With the new (non-datatables) implementation this could also be handled by
    making the search bar part of a form with a Submit button
    @private
*/
function _handleSearch() {
    $('input[type="search"]').on('keydown', function(e) {
        if (e.which == 13) {
            renderTable();
        }
    });
}

/*                        DEPRECATED                  */
/*
    Create a ligthbox similar to the featherlight plugin
    Eventually we want to minimize are use of dependencies, including
    Featherlight.JS
*/
function _addLightboxAUTHOR(resource, index) {
    var html_template = `<div class='ligthbox-grid' id='*id' hidden>
            <a target='_blank' href='*link'>*img<span align='center'><h3>*title</h3><span></a>
            *info
        </div>`;
    var author_info = "<a target='_blank' href='" + resource["Source Link"] + "'>" + resource.Source + "</a>";

    html_template = html_template.replace('*id', 'resource' + index);
    // console.log('building img with ' + resource.Thumbnail[0].url);
    if(resource.Thumbnail != undefined) 
        html_template = html_template.replace('*img',"<img class='lightbox' src='" + resource.Thumbnail[0].url + "'>");
    html_template = html_template.replace('*title', resource["Resource Name"]);
    html_template = html_template.replace('*info', "This resource was created by " + author_info + " and has the following keyword tags: " + resource.Tags);
    $('.grid-container').append(html_template);
}
/*
// Code to query airtable directly instead of by pinging the Linode
    base('Activities').select({
        view: 'Grid view',
        filterByFormula: query_string
    }).firstPage(function(err, records) {
        if (err) { console.error(err); return; }
        records.forEach(function(record) {
            search_results.push(record.fields);
        });
        renderFeatures(search_results);
        _buildTable(search_results);
        document.querySelector('.features').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
*/ 