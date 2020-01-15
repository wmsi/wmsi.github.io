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

    //work around to putting the text search with other filters and initially hiding the table
    $('#tech-filters').prepend($("#resource-table_filter"));
    $("#resource-table_filter").css('margin', '0');
    // $('#resource-table_wrapper').hide();
    $('.grid-container').hide();
});

/*
    Render the datatable with activities filtered by user
    @param {boolean} search - 'true' if user has filtered activities. 
        'false' if the whole table should be rendered
    search is becoming a default condition for rendering the table, which means we could remove it as an argument
*/
function renderTable(search=true) {
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    $('.grid-container').show();
    search_results = [];
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
}

/*
    Render 3 Featured Activities at the top of the page. 
    Check which of the search results have thumbnails, then render
    3 of those. 
    @param {array} search_results - list of activites returned based on a user search

    TODO: select activities by highest ratings
*/
function renderFeatures(search_results) {
    console.log('rendering features');
    var feature_list = [];
    search_results.forEach(function(resource) {
        if(resource.Thumbnail != undefined && feature_list.length < 3)
            feature_list.push(resource);
    });
    console.log('building ' + feature_list.length + ' features');
    _buildFeatures(feature_list);
}

/* 
    Reset all filters to their default values
*/
function resetFilters() {
    _resetFilters();
    $('input[type="search"]').val("");
    renderTable();
}

/*
    Reveal a the More Info lightbox for a resource
    @param {int} index - index of the resource in the table
*/
function showLightbox(index) {
    var id = '#resource' + index;
    $(id).show();
}

/*
    Add 3 features to the top of the page. 
    For now these can be any activities with thumbnails in the base.
    @private
*/
function _setupFeatures() {
    var feature_list = [];
    base('Activities').select({
        view: 'Grid view',
        filterByFormula: "NOT({Thumbnail} = '')"
    }).firstPage(function(err, records) {
        if (err) { console.error(err); return; }
        records = records.slice(0,3);
        records.forEach(function(record) {
            feature_list.push(record.fields);
        });
        console.log('building from ' + feature_list.length + ' features');
        _buildFeatures(feature_list);
    });
}

/*
    Build a query string for the Airtable API. This query will take into account all filters 
    and the text-based search.
*/
function _getQueryString() {
    var query = "AND(";
    if($('#subject').val() != "") 
        query += "Find('" + $('#subject').val() + "', Subject), ";
        // search_params.push("Subject=" + $('#subject').val());

    if($('#experience').val() != "") 
        query += "Find('" + $('#experience').val() + "', Experience), ";

    // if($('#no-tech').is(':checked') && !$('#tech').is(':checked'))
    //     query += "Find('unplugged', Tags), ";
    // else if(!$('#no-tech').is(':checked') && $('#tech').is(':checked'))
    //     query += "NOT(Find('unplugged', Tags)), ";
    query += _getMaterialsQuery();

    if($('input[type="search"]').val() != '')
        query += "Find('" + $('input[type="search"]').val().toLowerCase() + "', {Search Text}), ";

    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + ")";
    if(query == "AND)")
        alert('Please use at least one search option to find resources.');
    return query;
}

/*
    Helper function for _getQueryString
    Compile all the materials checkboxes into part of the Airtable query
    @private
*/
function _getMaterialsQuery() {
    var query = "OR(";

    if($('#browser').is(':checked'))
        query += "Find('Device w/ Browser', Materials), ";
    if($('#pen-paper').is(':checked'))
        query += "Find('Pen and Paper', Materials), ";
    if($('#craft').is(':checked'))
        query += "Find('Craft Supplies', Materials), ";
    if($('#art').is(':checked'))
        query += "Find('Art Supplies', Materials), ";
    if($('#robotics').is(':checked'))
        query += "Find('Robotics', Materials), ";

    if(query == "OR(")
        return "";

    string_preslice = query;
    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + "), ";
    return query;
}

/*
    Generate HTML for all resources returned by a search query. 
    Called by renderTable()
    @param {array} search_resutls - resources returned by a query search to airtable
    @private
*/
function _buildTable(search_results) {
    console.log('building ' + search_results.length + ' resources');
    var new_elements;
    var grid_item = "<span class='item'>*</span>";
    search_results.forEach(function(resource, index) {
        activity_link = grid_item.replace('*', '<a target="_blank" href="'+ resource["Resource Link"] +'">'+ resource["Resource Name"] +'</a>');
        if(resource['Tags'].includes('incomplete')) 
            activity_link = _adaptActivity(activity_link, index, resource["Resource Name"]);
        new_elements = activity_link;
        // new_elements += grid_item.replace('*', resource["Description"]);
        author_link = 'Created by <a target="_blank" href="' + resource["Source Link"] + '">' + resource["Source"] + '</a>'
        new_elements += grid_item.replace('*', author_link);
        new_elements += grid_item.replace('*', resource["Duration"]);
        new_elements += grid_item.replace('*', resource["Experience"]);
        new_elements += grid_item.replace('*', resource["Subject"]);
        new_elements += grid_item.replace('*', _starsMarkup(resource));
        new_elements += grid_item.replace('*',  "<center><big><a href='#' data-featherlight='#resource" + index + "'>&#9432;</a></big></center>");
        $('.grid-container').append(new_elements); 
        _addLightbox(resource, index);
    });  
    _postRatings();
}

/*
    Add rating column for an activity. As of 1/12/20 this feature is being
    rendered as responsive stars to click for a rating and a number/10 
    existing rating.
    @param {object} resrouce - Airtable resource object
    @private
*/
function _starsMarkup(resource) {
    var markup = $('#stars-template').html().replace('stars-id', resource["Resource Name"]);
    if(resource.Rating == undefined)
        markup = markup.replace('rating/5 by num','');
    else {
        markup = markup.replace('rating', Number.isInteger(resource.Rating) ? resource.Rating : resource.Rating.toFixed(2));
        markup = markup.replace('num', resource.Votes + (resource.Votes == 1 ? ' vote' : ' votes'));
    }

    return markup;
}

/*
    Trigger an event when stars are clicked and
    post a new rating to Airtable
    @private
*/
function _postRatings() {
    $('.star').click(function() {
        var name = $(this).parent().attr('id');
        var rating = $(this).attr('id').split('star')[1];
        if(confirm("Do you want to post a rating of " +rating+"/5 to "+name+"?")) {
            console.log('posting ' + rating + ' to airtable for activity ' + name);
            var resource = search_results.find(x => x["Resource Name"] == name);
            var votes = resource.Votes;
            var new_rating = (resource.Rating*votes + parseInt(rating))/(++votes);
            console.log('posting rating of ' + new_rating + ' based on ' + votes + ' votes');
            base('Activities').update([
                {
                    "id": resource.id,
                    "fields": {
                        "Rating": new_rating,
                        "Votes": votes
                    }
                }]);
        }
    });
}

/*
    Create a lightbox to house the "More Info" text for an activity
    This includes a thumbnail if the activity has one, link to the activity,
    activity description, and activity tags.
    @param {object} resource - resource object as returned from Airtable
    @param {int} index - number of the activity in the search results. 
        also the html id number for this element
    @private

    TODO: create lightbox with generic thumbnail image if no thumbnail exists. 
        continue to evaluate what content fits best here
*/
function _addLightbox(resource, index) {
    var html_template = `<div class='ligthbox-grid' id='*id' hidden>
            <a target='_blank' href='*link'>*img<span align='center'><h3>*title</h3><span></a>
            <br />
            <span>*description</span><br />
            <span>*materials</span><br />
            <span>*tags</span>
        </div>`;
    var author_info = "<a target='_blank' href='" + resource["Source Link"] + "'>" + resource.Source + "</a>";

    html_template = html_template.replace('*id', 'resource' + index);
    html_template = html_template.replace('*link', resource["Resource Link"]);
    // console.log('building img with ' + resource.Thumbnail[0].url);
    if(resource.Thumbnail != undefined) 
        html_template = html_template.replace('*img',"<img class='lightbox' src='" + resource.Thumbnail[0].url + "'>");
    html_template = html_template.replace('*title', resource["Resource Name"]);
    html_template = html_template.replace('*description', resource["Description"]);
    if(resource.Materials != "None")
        html_template = html_template.replace('*materials',  "This activity requires the following materials: " + resource["Materials"]);
    html_template = html_template.replace('*tags', "Keyword tags: " + resource.Tags);
    $('.grid-container').append(html_template);
}

/*
    Create a ligthbox similar to the 
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
    Clear the table from previous search results
*/
function _clearTable() {
    $('.item').remove();
    $('.lightbox').remove();
}

/*
    Start a new search if the user presses "Enter" after typing in the search box.
    With the new (non-datatables) implementation this could also be handled by
    making the search bar part of a form with a Submit button
*/
function _handleSearch() {
    $('input[type="search"]').on('keydown', function(e) {
        if (e.which == 13) {
            renderTable(true);
        }
    });
}
