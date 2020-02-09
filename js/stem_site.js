// When the page loads populate the table with activities and render the dropdown menus.
// Add a graderange to each activity that JS can interpret
$(document).ready(function(){
    // console.log('table length ' + resource_table.Activities.length);
    // _buildTable();
    _renderSelects();
    _setupFeatures();
    _handleSearch();

    $('.grid-container').hide();
    $('#search').click(function() {renderTable()});
    $('#reset').click(function() {resetFilters()});
    $('#uncheck-materials').click(function() {
        $(':checkbox').prop('checked', false);
    });
});

/*

/*
    Render STEM Resource table based on search parameters
    Generate a query and send it to the API proxy on our Linode
    (wmsinh.org), then handle the response
*/
function renderTable() {
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    console.log('filter by formula: ' + query_string);
    $('.grid-container').show();
    var search_results = [];
    var url = "https://wmsinh.org/airtable?query=" + query_string;
    // var url = "http://localhost:5000/airtable?query=" + query_string;
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url
    }).done(function(data, status) {
        search_results=JSON.parse(data);
        _renderFeatures(search_results);
        if(!_sortResults(search_results))
            _buildTable(search_results);
        document.querySelector('.features').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

/*
    Sort search results by field values. Event triggered when user clicks an 
    arrow next to one of the column headers
    @param {array} search_results - activities returned by Airtable
    @returns {boolean} true if table was built from existing sort, false if no build happens
    @private
    TODO: we could avoid calling this with every search by keeping a permanent reference to
        search_results
*/
function _sortResults(search_results) {
    $('i').click(function() {
        var ascending = $(this).attr('class') == 'up' ? true : false;
        var field = $(this).parent().attr('id');
        // console.log('sorting by ' + field);
        if(field == "activity")
            _sortText(search_results, "Resource Name", ascending);
        if(field == "author")
            _sortText(search_results, "Source", ascending);
        if(field == "time")
            _sortTime(search_results, ascending);
        if(field == "experience")
            _sortExperience(search_results, ascending);
        if(field == "subject")
            _sortText(search_results, "Subject", ascending)
        if(field == "rating")
            _sortRating(search_results, ascending);

        _clearTable();
        _buildTable(search_results);
        $('i').css('border-color', 'black');
        $('i').removeAttr('alt');
        $(this).css('border-color', 'green');
        $(this).attr('alt', 'selected');
    });
    // if sort exists from previous search apply it to this one
    $('i[alt="selected"]').click();
    if($('i[alt="selected"]').length)
        return true;
    else
        return false;
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
    // console.log('building ' + feature_list.length + ' features');
    if(feature_list.length == 0)
        $('#feature-container').hide();
    else {
        $('#feature-container').show();
        _buildFeatures(feature_list);
    }
}

/*
    Add 3 features to the top of the page. 
    For now these can be any activities with thumbnails in the base.
    @private
    TODO: streamline Airtable query to return fewer features to choose from (e.g. filter by rating)
*/
function _setupFeatures() {
    var search_results = [];
    $('.grid-container').show();
    var search_results = [];
    var url = "https://wmsinh.org/airtable?query=AND(NOT({Thumbnail} = ''), NOT(Find('inomplete', Tags)))";
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url
    }).done(function(data, status) {
        search_results=JSON.parse(data);
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
    _postRatings(features);
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

// var Airtable = require('airtable');
// Airtable.configure({
//     endpointUrl: 'https://api.airtable.com',
//     apiKey: WRITE_API_KEY
// });
// var base = Airtable.base('app2FkHOwb0jN0G8v');
/*
    The original renderTable() used the Airtable JS class (above) to get
    and update records from the base. As of 1/29/20 this funcitonality
    has been moved to the server (wmsinh.org) in order to protect our API key
*/
function renderTableDEPRECATED() {
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
    Create DOM elements for the features to live in
    @private
*/
function _setupFeatureElemnts() {
    $('#load-div').after(`
    <span id="content"> </span>
    <section id="feature-container">
      <br /><h3>Featured Activities:</h3><br />
      <div class="features">
        <div class="featured-activity" id="featurediv1"></div>
        <div class="featured-activity" id="featurediv2"></div>
        <div class="featured-activity" id="featurediv3"></div>
      </div>
    </section>
    <br />`);
}

/*
    Trigger an event when stars are clicked in order to post a new rating to Airtable
    @param {array} search_results - list of resources returned by Airtable from a user-generated search
    @private
*/
// function _postRatingsDEPRECATED(search_results) {
//     $('.star').click(function() {
//         var name = $(this).parent().attr('id');
//         var rating = $(this).attr('id').split('star')[1];
//         if(confirm("Do you want to post a rating of " +rating+"/5 to "+name+"?")) {
//             var resource = search_results.find(x => x["Resource Name"] == name);
//             var votes = (resource.Votes == undefined ? 0 : resource.Votes);
//             var new_rating = (resource.Rating*votes + parseInt(rating))/(++votes);
//             if(resource.Rating == undefined) 
//                 new_rating = parseInt(rating);
//             console.log('posting rating of ' + new_rating + ' based on ' + votes + ' votes');
//             base('Activities').update([
//                 {
//                     "id": resource.id,
//                     "fields": {
//                         "Rating": new_rating,
//                         "Votes": votes
//                     }
//                 }]);
//         }
//     });
// }

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