// When the page loads populate the table with activities and render the dropdown menus.
// Add a graderange to each activity that JS can interpret
$(document).ready(function(){
    // console.log('table length ' + resource_table.Activities.length);
    // _buildTable();
    _renderSelects();
    _setupFeatures();
    _handleSearch();

    $(window).scroll(() => scrollTopButton());
    $('#scroll-top-btn').click(() => $("html, body").animate({scrollTop: '320'}, 600));
    $('.grid-container').hide();
    $('.lds-ring').hide();
    $('#search').click(function() {renderPages()});
    $('#reset').click(function() {resetFilters()});
    $('#uncheck-materials').click(function() {
        $('#materials-filter').children().prop('checked', false);
    });
    _fixTabIndex();
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
    // if(query_string == 'AND)')
    //     return;
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
    Manage locally stored search results. Update sorting, meta data, and buttons
    as necessary.
    @param {array} search_results - all results returned by the current search
    @param {int} page_size - number of results per page
    @param {int} page - number of the current page
    @param {boolean} sort - variable to keep sort from always calling this function recursively
    @private
*/
function _manageTableLocal(search_results, page_size, page=0, sort=true) {
    var start = page*page_size;
    var end = Math.min((page+1)*page_size, search_results.length);
    this_page = search_results.slice(start, end); // change this to default first page
    console.log('rendering search results from index ' + start + ' to ' + end);
    _clearTable();
    _buildTable(this_page);
    _displayMetaData(this_page, page_size, page, search_results.length);
    _createLocalButtons(search_results, page_size, page);
    _sortResults(search_results, false);
    $('.item-header i').click(() => {_manageTableLocal(search_results, page_size, page)});
    $('#results-per-page').unbind('change').change(function() {changePageLengthLocal(start, search_results)});  
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
    Start a new search if the user presses "Enter" after typing in the search box.
    With the new (non-datatables) implementation this could also be handled by
    making the search bar part of a form with a Submit button
    @private
*/
// function _handleSearch() {
//     $('input[type="search"]').on('keydown', function(e) {
//         if (e.which == 13) {
//             renderTable();
//         }
//     });
// }
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