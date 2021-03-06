// var final_load = false;
search_results = [];
$(document).ready(function(){
    $('.grid-container').hide();
    $('.lds-large').hide();
    $('.lds-ring').hide();

    _renderSelects();
    // _setupFeatures();    // no need for this if we do an initial load of all activities
    _handleSearch();
    setupDevMenu();
    _bindScrollClicks();
    _fixTabIndex();

    $(window).scroll(() => scrollTopButton());
    $('#scroll-top-btn').click(() => $("html, body").animate({scrollTop: '125'}, 600));
    $('#search').click(() => renderPages());//renderTable()});
    $('#reset').click(() => resetFilters());
    $('#self-led-button').click(() => renderSelfLed());
    $('#uncheck-materials').click(() => $('#materials-filter').children().prop('checked', false));
    renderPages();// initialLoad();
});
$(window).load(() => console.log("Window load time: ", window.performance.timing.domComplete - window.performance.timing.navigationStart));

/*
    Perform an initial load of activities into the table using multiPageLoad
    Cache results locally for future searches
    DEPRECATED: initalLoad now takes place with renderPages()
*/
function initialLoad() {
    var query = "NOT({Resource Name}='')";
    var page_size = 50;
    // var search_results = [];

    _displayLoading(true);
    $('.grid-container').show();
    
    _getResults(url, {query: query}).done(function(data, status, jqXHR) {
        if(!_safeParse(data, search_results))
            return _handleSearchFail();
        _manageTableLocal(search_results, page_size);
        _renderFeatureCarousel(search_results);
        _displayLoading(false);

        console.log("Initial load time: ", Date.now() - window.performance.timing.navigationStart);
        // if(final_load)
        //     console.log("Initial load time: ", Date.now() - window.performance.timing.navigationStart);
        // else
        //     final_load = true;
    });
    remaining.then((data, status, xhr) => (search_results.length < num_results  ? _multiPageLoad(data, xhr, search_results) : null));

}
/*
    Obtain search results and cache them locally while displaying pages one at a time
    DEV: prototype using serverless HTTP proxy
*/
function renderPages() {
    var timer = Date.now();
    var query_string = _getQueryString();
    var page_size = parseInt($('#results-per-page').val());
    // var search_results = [];

    _displayLoading(true);
    $('.grid-container').show();        // put this elsewhere?
    $('#sort-results').val('');

    // continue to evaluate caching activities locally (pending speed test)
    // if(search_results.length > 0) {
    //     _displayResults(search_results, page_size);
    //     console.log("Render results time: ", Date.now() - timer);
    // } else {

        // setup for testing vs local cache
        search_results = [];
        var num_results = 0;
        var data = {query: query_string, page_size: page_size, offset: false};

        // Chain AJAX requests so that we load the remaining results after the first page has rendered
        var first_page = _getResults(url, data).fail(() => _handleSearchFail());
        first_page.then((data, status, xhr) => num_results = _multiPageLoad(data, xhr, search_results, true));
        first_page.fail(() => _handleSearchFail());
        first_page.done(() => console.log("Activities displayed time: ", Date.now() - timer));

        // offset lets the HTTP proxy know to omit the first page
        data.offset = true;
        var remaining = first_page.then(() => (search_results.length < num_results ? _getResults(url, data) : false));

        remaining.fail(() => _handleSearchFail());
        remaining.then(function(data, status, xhr) {
                // console.log("remaining.then with xhr ", xhr);
                search_results.length < num_results  ? _multiPageLoad(data, xhr, search_results) : null;
                console.log("Initial load time: ", Date.now() - timer);
            });
    // }
}

/*
    Display results from search_results in Featured Activities and in the table
    @param {object} search_results - list of activities to display
    @param {int} page_size - number of results to display on a page.
    TODO: Combine this with same function in shared_functions.js by 
        integrating renderFeatures and renderFeatureCarousel
*/
function _displayResults(search_results, page_size) {
    console.log('display results with page_size ' + page_size + ' and length ' + search_results.length);
    _manageTableLocal(search_results, page_size);
    _renderFeatureCarousel(search_results);
    _displayLoading(false);
    document.querySelector('#feature-container').scrollIntoView({ 
      behavior: 'smooth' 
    });
}

/*
    Render the first page when it loads, then add subsequent data to search_results
    When all data has loaded hand off management to _manageTableLocal()
    This can also be used to handle a large single load
    @param {object} data - response data from AJAX GET
    @param {object} xhr - response object including headers and status
    @param {array} search_results - array to contain all search resutls from Airtable
    @param {boolean} first - true if this is the first page
    @returns {int} num_results - total number of results that match the search criteria
    @private
*/
function _multiPageLoad(data, xhr, search_results, first=false) {
    if(!_safeParse(data, search_results))
        return _handleSearchFail();
    var num_results = xhr.getResponseHeader('num_results');
    var page_size = xhr.getResponseHeader('page_size');
    if(first) {
        _renderFeatureCarousel(search_results);
        _clearTable();
        _buildTable(search_results, 'dev');
        _displayMetaData(search_results, search_results.length, 0, num_results);
        _displayLoading(false);
        document.querySelector('#feature-container').scrollIntoView({ 
          behavior: 'smooth' 
        });
    } 
    if(search_results.length == num_results) {
        _manageTableLocal(search_results, page_size, 0, !first);
    }
    return num_results;
}


/*
    Parse the response data or push it directly if it is an array
    @param {object} data - response data from http proxy
    @param {array} search_results - array to append search results onto
    @private
    TODO: expand exception handling to include other cases.
*/
function _safeParse(data, search_results) {
    try {
        Array.prototype.push.apply(search_results, JSON.parse(data));
    } catch (err) {
        // console.log('parse failed, attempting push', err);
        try {
            Array.prototype.push.apply(search_results, data);
        } catch {
            // console.log('cannot parse search results', err);
            return false;
        }
    }
    return true;
}

/*
    Manage locally stored search results. Update sorting, meta data, and buttons
    as necessary.
    @param {array} search_results - all results returned by the current search
    @param {int} page_size - number of results per page
    @param {int} page - number of the current page
    @param {boolean} build - defaults to true, false means initial build has already happened
    @private
*/
function _manageTableLocal(search_results, page_size, page=0, build=true) {
    var start = page*page_size;
    var end = Math.min((page+1)*page_size, search_results.length);
    this_page = search_results.slice(start, end); // change this to default first page

    if(build) {
        _clearTable();
        _buildTable(this_page, 'dev');
        _displayMetaData(this_page, page_size, page, search_results.length);
    } 

    _createLocalButtons(search_results, page_size, page);
    _sortResults(search_results, false);
    _sortResultsDropdown(search_results, false);

    // could some of these be run once by using global variables?
    $('#sort-results').change(() => {_manageTableLocal(search_results, page_size, page)});
    $('.item-header i').click(() => {_manageTableLocal(search_results, page_size, page)});
    $('#results-per-page').unbind('change').change(function() {changePageLengthLocal(start, search_results)});  
}


/*
    Handle the event of a user posting a new comment on a featured activity
    When a user clicks the Post Comment button parse the comment text 
    and send it to Airtable
    @param {int} index - index of activity in the table, used to make IDs
    @param {object} resource - resource object to post comment for
    @private
    TODO: shorter ID names?
*/
function _postComment(resource, index, feature = false) {
    // var id = '#feature-post-comment' + index;
    var id = (feature ? '#feature-post-comment' + index : '#post-comment' + index);
    var comment_id = (feature ? '#feature-new-comment' + index : '#new-comment' + index);
    var user_id = (feature ? '#feature-comment-name' + index : '#comment-name' + index);

    $(id).unbind('click').click(function() {
        var comment = $('.featherlight-inner ' + comment_id).val();
        var user = $('.featherlight-inner ' + user_id).val();
        user = (user == "" ? "Anonymous" : user);
        if(comment != '') {
            var formatted_comment = '["' + user + '", "' + comment + '"]';
            console.log('posting comment: '+ comment +' to airtable from user ' + user);
            $.ajax({
                type: 'POST',
                // url: 'https://wmsinh.org/airtable',
                // url: 'http://localhost:5000/airtable',
                url: "https://us-central1-sigma-tractor-235320.cloudfunctions.net/http-proxy",
                data: {
                    "id": resource.id,
                    "New Comment": formatted_comment
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.log("post comment failed :( \n" + textStatus + ': ' + errorThrown);
            });

            // Wait for approval on new comments. Show some kind of success message that comment was received
            var markup_id = '.featherlight-inner ' + (feature ? '#feature-' : '#') + 'comment-text' + index;
            $(markup_id).empty().append('<b>Thanks for posting a comment! We will review your comment within the next 1-2 weeks and put it right here.');
            // $('.featherlight-inner #feature-comment-text'+index).append(user + ': ' + comment + '<br>');
            $('.featherlight-inner ' + comment_id).val('');
            $('.featherlight-inner ' + user_id).val('');
        }
    });
}

/*
    Handle events related to dev features menu footer #dev-menu
    Users can click checkbox to toggle dev features on and off,
    allowing for easier comparison of appearance/ behavior
*/
function setupDevMenu() {
    $('#top-carousel-toggle').click(function() {
        if($('#top-carousel-toggle').is(':checked'))
            $('.top-features').show();
        else 
            $('.top-features').hide();
    });
    $('#pages-toggle').click(function() {
        if($('#pages-toggle').is(':checked')) {
            $('.page-controls').show();
            $('#results-meta').show();
            $('#search').unbind('click').click(function() {renderPages()});
        } else { 
            $('.page-controls').hide();
            $('#results-meta').hide();
            $('#search').unbind('click').click(function() {renderTable()});
        }
    });
    $('#sort-toggle').click(function() {
        if($(this).is(':checked'))
            $('#sort-results').show();
        else 
            $('#sort-results').hide();
    });
    $('#hover-comments').click(function() {
        $('.comment-tooltip').toggleClass('tooltip');
        $('.comment').toggle();
    });
    $('#self-led-toggle').click(function() {
        $('#self-led-button').toggle();
        $('#self-led-checkbox').toggle();
    });
    $('#features-toggle').click(function() {
        // switch carousel to 3 top features
        _swapFeaturesMarkup();
        renderPages();
    });
}

/* 
    Change out the Featured Activities Carousel for static Features
    when user toggles this feature in the Dev Menu
    @private
*/
function _swapFeaturesMarkup() {
    var carousel = `
        <a class="scroll" id="scroll-left"><</a>
        <ul class="feature-list" id="feature-results">
        </ul>
        <a class="scroll" id="scroll-right">></a>`;
    var static = `<br /><h3>Featured Activities:</h3><br />
      <div class="features">`;

    if($('#features-toggle').is(':checked'))
        $('#feature-container').html(carousel);
    else
        $('#feature-container').html(static);
}

/*
    Add a 'self-led activities' filter on top of any other search filters
    TODO: find a cleaner way to implement this
*/
function renderSelfLed() {
    $('#self-led').prop('checked', true);
    // renderTable();
    renderPages();
    $('#self-led').prop('checked', false);
}

/*
    Sort search results based on selected dropdown option
    @param {array} search_results - Airtable activities based on search options
    @param {boolean} build - call _buildTable() from here? Unnecessary when called
        by _manageTableLocal()
    @private
*/
function _sortResultsDropdown(search_results, build=true) {
    $('#sort-results').unbind('change').change(function(event) {
        event.stopPropagation();
        var sort = $(this).val();
        if(sort == "")
            _sortText(search_results, "Resource Name", true);
        if(sort == "experience-low") 
            _sortExperience(search_results, true);
        if(sort == "experience-high") 
            _sortExperience(search_results, false);
        if(sort == "time-short") 
            _sortTime(search_results, true);
        if(sort == "time-long") 
            _sortTime(search_results, false);
        if(sort == "rating")
            _sortRating(search_results);

        if(build) {
            _clearTable();
            _buildTable(search_results);
        }
    });

    // if a sort mode is selected apply it to the new search
    if($('#sort-results').val() != '')
        $('#sort-results').change();
}

/*
    Add features to the top of the page. 
    Features are chosen using the _buildFeatureList function
    @private
*/
function _setupFeatures() {
    var search_results = [];
    // var url = "https://wmsinh.org/airtable";
    var url = "https://us-central1-sigma-tractor-235320.cloudfunctions.net/http-proxy";
    var data = {query: "AND(NOT({Thumbnail} = ''), NOT(Find('incomplete', Tags)))"};

    $('.lds-large').show();

    _getResults(url, data).done(function(data, status) {
        // search_results=JSON.parse(data);
        _safeParse(data, search_results);
        feature_list = _buildFeatureList(search_results);
        _buildFeatureCarousel(feature_list, '#feature-header');
        $('.lds-large').hide();
        if(final_load)
            console.log("Initial load time: ", Date.now() - window.performance.timing.navigationStart);
        else
            final_load = true;
    });
}

/*
    Re-build features carousel at top of the page.
    Features are chosen using the _buildFeatureList function
    @private
*/
function _renderFeatureCarousel(search_results) {
    $('#feature-results').empty();
    //TODO: do this differently or remove, depending on final carousel location
    if($('.welcome').length) {
        $('.welcome').remove();
        $('#feature-header').parent().remove();
        _bindScrollClicks();
    }

    var feature_list = _buildFeatureList(search_results);
    // console.log('rendering ' + feature_list.length + ' new features');
    if(feature_list.length == 0)
        $('#feature-container').hide();
    else {
        if($('#features-toggle').is(':checked'))
            _buildFeatureCarousel(feature_list, '#feature-results');
        else
            _renderFeatures(search_results);
        $('#feature-container').show();
    }

}

/*
    Create three features to appear above the table. Features can fit whatever criteria we want-
    ideally this would tie in to our rating system. In this version, the features are also rendered
    into a carousel using Slick.
    @param {array} feature_list - a list of activities that could be used as features. Currently this
        is all activities with an "Img URL" field
    @returns {array} features - featured activities to display above the table
    @private
*/
function _buildFeatureCarousel(features, location) {
    features.map(function(resource, i) {
        var template = $('#featured-activity-template').html();

        template = template.replace(/@index/g, i);
        template = template.replace(/@title/g, resource["Resource Name"]);
        template = template.replace('*link', resource["Resource Link"]);
        template = template.replace('*img', 'src="'+resource.Thumbnail[0].url+'"');
        template = template.replace('*description', resource['Description']);
        template = template.replace('*experience', resource['Experience']);
        template = template.replace('*subjects', resource['Subject']);//(Array.isArray(item["Subject"]) ? item["Subject"].join(", ") : item["Subject"]));
        template = template.replace('*materials', resource['Materials']);
        template = template.replace('*source', resource['Source']);
        template = template.replace('*src_link', resource['Source Link']);

        $(location).append("<li>" + template + "</li>");
        if(location != '#feature-header')
            _addFeatureComments(resource, i);
        // $("#featured-activities").append("<div class='thumbnail' list-index='" + features.indexOf(item) + "'>" + feature_div + "</div>");
    });
    $(location).css('grid-template-columns', 'repeat(' + features.length + ', 240px)');
    _postRatings(features);
}


/*
    Trigger a scroll of the features carousel when user clicks on an arrow
    This gets called whenever a new carousel is rendered (e.g. after a search)
    @private
*/
function _bindScrollClicks() {
    $('#scroll-right').click(function() {
        $('.feature-list').animate( {scrollLeft: '+=780' }, 500);
    });
    $('#scroll-left').click(function() {
        $('.feature-list').animate( {scrollLeft: '-=780' }, 500);
    });
}













////////////////////      DEPRECATED          ///////////////////////
/*
    Obtain search results one page at a time instead of all at once to preserve
    connection speed. Eventually this may replace renderTable() as the default
    "render" function. 
    @param {int} page_size - number of results to render per page
    @param {int} page - page number 
    TODO: how do we implement sort with the page by page approach?
*/
function renderPage(page_size=50, page=0) {
    _displayLoading(true);
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    console.log('getting page: ' + page);
    $('.grid-container').show();
    var search_results = [];
    // var url = "https://wmsinh.org/airtable?query=" + query_string;
    // var url = "https://wmsinh.org/airtable";
    var url = "http://localhost:5000/airtable";
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url,
        data: {
            query: query_string,
            page_size: page_size,
            page_num: page,
            sort: _getSortTuple()
        }
    }).done(function(data, status, jqXHR) {
        search_results=data;//JSON.parse(data);
        var num_results = parseInt(jqXHR.getResponseHeader('num_results'));
        _renderFeatureCarousel(search_results);
        _buildTable(search_results);
        _displayLoading(false);
        // test = jqXHR;
        _displayMetaData(search_results, page_size, page, num_results);
        $('#results-per-page').unbind('change').change(function() {changePageLength(page_size*page)});
        _createButtonFunctions(page, (page+1)*page_size, num_results);
        _sortResults(search_results);
        _sortResultsDropdown(search_results);
        document.querySelector('#feature-container').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

/*
    Render STEM Resource table based on search parameters
    Generate a query and send it to the API proxy on our Linode
    (wmsinh.org), then handle the response
    DOES NOT use pages, ie renders all results at once
*/
function renderTable() {
    _displayLoading(true);
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    console.log('filter by formula: ' + query_string);
    $('.grid-container').show();
    search_results = [];
    // var url = "https://wmsinh.org/airtable?query=" + query_string;
    var url = "https://wmsinh.org/airtable";
    // var url = "http://localhost:5000/airtable";
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url,
        data: {
            query: query_string
        }
    }).done(function(data, status) {
        search_results=JSON.parse(data);
        _renderFeatureCarousel(search_results);
        _buildTable(search_results);
        _displayLoading(false);
        _displayMetaData(search_results, search_results.length);
        _sortResults(search_results);
        _sortResultsDropdown(search_results);
        document.querySelector('#feature-container').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

/*
    Attach behavior to Next Page and Last Page buttons
    Unbind any functions previously attached to those buttons
    Change styling to reflect (in)active buttons
    @param {int} page - current page number
    @param {int} last - index of the last record on the current page
    @param {int} num_results - total number of results returned by the current search
    @private
*/
function _createButtonFunctions(page, last, num_results) {
    console.log('creating button functions with page ' + page + ', end ' + last + ', num_results ' + num_results);
    var next_page = last < num_results ? true : false;
    var last_page = page > 0 ? true : false;
    if(next_page) {
        $('#next-page').unbind('click').click(function() {
            renderPage(parseInt($('#results-per-page').val()), page+1);
        });
    } 
    if(last_page) {
        $('#last-page').unbind('click').click(function() {
            renderPage(parseInt($('#results-per-page').val()), page-1);
        });
    } 
    _buttonCss(next_page, last_page);
}

/*
    Make a sort tuple to incorporate into Airtable query
    @private
    TODO: our sort doesnt map well to Airtable's (e.g. experience, duration strings)
        Find a way to massage field values to sort alphabetically
        **OR cache all results and paginate locally
*/
function _getSortTuple() {
    var sort = $('#sort-results').val();
    if(sort == "experience-low") 
        return ['Experience', 'asc'];
    if(sort == "experience-high") 
        return ['Experience', 'desc'];
    if(sort == "time-short") 
        return ['Duration', 'asc'];
    if(sort == "time-long") 
        return ['Duration', 'asc'];
    if(sort == "rating")
        return ['Rating', 'asc'];
    else
        return '';
}

/*
    The following functions were used with the CS Resource table but are not a part 
    of the current build. They may involve the datatables plugin and/ or the Google Sheets API
*/

/*
    Trigger an event when stars are clicked and
    post a new rating to Airtable
    @private
*/
// function _postRatings() {
//     $('.star').click(function() {
//         var name = $(this).parent().attr('id');
//         var rating = $(this).attr('id').split('star')[1];
//         if(confirm("Do you want to post a rating of " +rating+"/5 to "+name+"?")) {
//             console.log('posting ' + rating + ' to airtable for activity ' + name);
//         }
//     });
// }


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
    Reveal a the More Info lightbox for a resource
    @param {int} index - index of the resource in the table
*/
function showLightbox(index) {
    var id = '#resource' + index;
    $(id).show();
}

function renderTableDEPRECATED(search=false) {
    // var render_data = _filterResources(resource_table[table_state]);
    var table_source = [];
    var search_string = _getSearchString();//$('input[type="search"]').val();
    // var resource_link;
    
    if(render_data.length == 0) {
        alert('This Search returned no activities.');
        return;   
    }
    
    renderFeatures(render_data);

    $.map(render_data, function(item, index) {
        var subjects = Array.isArray(item["Subject"]) ? item["Subject"].join(", ") : item["Subject"];
        // var author_link = '<a target="_blank" href="' + item["Author Link"] + '">' + item["Author"] + '</a>';
        var activity_link = '<a target="_blank" href="' + item["Resource Link"] + '"">' + item["Resource Name"] + '</a>';

        var lightbox = _moreInfo(item, index);

        if(item['Tags'].includes('incomplete')) {
            resource_link = _adaptActivity(activity_link, index, item["Resource Name"]);
        } else
            resource_link = activity_link;

        table_source.push([resource_link, item["Description"], item["Duration"], item["Grade Level"], subjects, item["Tech Required"], lightbox]);       
    });

    if(table_ref)
        _refreshTable(table_source, search_string);
    if(search) {
        $('#resource-table_wrapper').show();
        document.querySelector('#content').scrollIntoView({ 
          behavior: 'smooth' 
        });
        location.hash = search_string;
    }
    return table_source;
}

/*
    Get the "Resource Table" Google sheet from https://docs.google.com/spreadsheets/d/1EdmNxW0F5jTdkemGx95QB_WbasvWVGEfVXuCAZ19cXU/
    Once the HTTP Request is complete, call helper functions to populate the array and build
    page features. This function makes use of the Google Sheets API
    Reference: https://developers.google.com/sheets/api/
    @private
*/
function _buildTableDEPRECATED() {
    // _displayLoading(true);
    _addGradeRange();
    _renderSelects();
    // var table = _setupDataTable(renderTable());
    _setupDataTable(renderTable());
    // renderFeatures();
    return;
    
    $.ajax({
        url: "https://content-sheets.googleapis.com/v4/spreadsheets/1EdmNxW0F5jTdkemGx95QB_WbasvWVGEfVXuCAZ19cXU/values/A2%3AM",
        type: "get",
        data: {
          majorDimension: 'ROWS',
          // ranges: 'A7:M10',
          key: API_KEY
        },
        success: function(response) {
            var new_activities = _storeData(response);
            // _displayLoading(false);
            _addGradeRange(new_activities);
            _updateSelects();
            renderTable();
        },
        error: function(error) {
            _displayError(error);
        },
        timeout: 10000
    });
}


/*
    Create a search string from the chosen filter options. 
*/
function _getSearchString() {
    var search_params = [];

    // if($('input[type="search"]').val() != "")
    //     search_params.push($('input[type="search"]').val());
    
    if($('#subject').val() != "") 
        search_params.push("Subject=" + $('#subject').val());

    if($('#grade').val() != "")
        search_params.push("Grade=" + $('#grade').val());

    if($('#no-tech').is(':checked'))
        search_params.push('unplugged');

    if($('#tech').is(':checked'))
        search_params.push('tech');

    return "q=" + search_params.join('&');
}

/*
    Store Google Sheet data in the resource_table variable
    This involves parsing every row from the table (stored as arrays)
    into individual JSON objects
    @param {object} response- REST response 
    @private
*/
function _storeData(response) {
    var new_activities = [];
    console.log("processing " + response.values.length + " activities from Google Sheets");
    for(let i=0; i<response.values.length; i++) {
        var value = response.values[i];
        if(!value[11])
            value[11] = "";
        
        // resource_table.Activities.push({
        var new_activity = {
          "Resource Name": value[0],
          "Resource Link": value[1],
          "Duration": value[2],
          "Grade Level": value[3],
          "Subject": value[4].split(", "),
          "Tech Required": value[5].split(", "),
          "Author": value[6],
          "Author Link": value[7],
          "Tags": value[8].split(", "),
          "Additional Info": value[9],
          "Description": value[10],
          "Img URL": value[11]
        };

        if(!resource_table.Activities.find(act => act["Resource Name"] === new_activity["Resource Name"])) {
            console.log("pushing " + new_activity["Resource Name"]);
            resource_table.Activities.push(new_activity);
            new_activities.push(new_activity);
        }
    }
    return new_activities;
}

/*
    Wrap our table with the DataTables plugin from https://www.datatables.net/
    This makes the columns sortable and options for filtering by a search bar
    and displaying n entries per page.
*/
function _setupDataTable(table_source) {
    // custom grade sort could use some improvement, e.g. so 3-9 is higher than K-5
    jQuery.fn.dataTableExt.oSort["grade-desc"] = function (x, y) {
        x = x.match(/\d+/);
        y = y.match(/\d+/);
        return y-x;
    };

    jQuery.fn.dataTableExt.oSort["grade-asc"] = function (x, y) {
        x = x.match(/\d+/);
        y = y.match(/\d+/);
        return x-y;
    };

    table_ref = $('#resource-table').DataTable({
        data: table_source,
        // columns: columns
      "pageLength": 50,
      "columnDefs": [
            { "orderable": false, "targets": [1, 4, 5, 6] },
            { "type": "grade", "targets": 3 }
            // { "dom": '<"wrapper"fli>' }
        ]
    });
    // datatable = table_ref;
    // return table_ref;
}